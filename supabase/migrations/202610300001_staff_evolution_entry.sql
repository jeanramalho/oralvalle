-- NexoDent 151: permitir que membros ativos autorizados registrem evoluções
-- pela interface existente, sem se passarem por dentistas.
-- Execute no SQL Editor do Supabase após revisar e fazer backup.
CREATE OR REPLACE FUNCTION private.nexodent_register_evolution_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
    v_dentist_id text;
    v_member_active boolean;
BEGIN
    IF NEW.slot <> 'evol'
       OR NEW.kind <> 'object'
       OR NEW.dados->>'auto' = 'true'
    THEN
        RETURN NEW;
    END IF;

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'NEXODENT_AUTH_REQUIRED: usuário autenticado obrigatório'
            USING ERRCODE = '42501';
    END IF;

    SELECT cm.active IS TRUE INTO v_member_active
    FROM public.clinic_members cm
    WHERE cm.clinic_id = NEW.clinic_id AND cm.user_id = auth.uid();

    IF COALESCE(v_member_active, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'NEXODENT_MEMBER_REQUIRED: membro ativo obrigatório'
            USING ERRCODE = '42501';
    END IF;

    SELECT du.dentist_id INTO v_dentist_id
    FROM public.nexodent_dentist_users du
    JOIN public.dentists d
      ON d.clinic_id = du.clinic_id AND d.id = du.dentist_id
    WHERE du.clinic_id = NEW.clinic_id
      AND du.user_id = auth.uid()
      AND d.dados->'ativo' = 'true'::jsonb;

    -- Identidade e horário são definidos pelo servidor, nunca pelo navegador.
    NEW.dados := COALESCE(NEW.dados, '{}'::jsonb)
      - 'entered_by_user_id' - 'entered_at' - 'entry_origin';
    NEW.dados := NEW.dados || pg_catalog.jsonb_build_object(
        'entered_by_user_id', auth.uid()::text,
        'entered_at', pg_catalog.clock_timestamp()::text,
        'entry_origin', CASE WHEN v_dentist_id IS NULL
                             THEN 'administrative_entry'
                             ELSE 'dentist_entry' END
    );

    -- Apenas um dentista autenticado é vinculado como autor clínico.
    IF v_dentist_id IS NOT NULL THEN
        INSERT INTO public.nexodent_evolution_dentists (
            clinic_id, evolution_id, dentist_id
        ) VALUES (NEW.clinic_id, NEW.id, v_dentist_id);
    END IF;

    RETURN NEW;
END;
$function$;
