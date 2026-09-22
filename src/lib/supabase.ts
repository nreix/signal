import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase CÔTÉ SERVEUR uniquement (clé service_role).
 * Ne jamais importer dans un composant client — la clé secrète ne doit pas
 * atteindre le navigateur. Utilisé seulement dans les routes API.
 * `null` si les variables d'environnement manquent (l'app reste fonctionnelle).
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase: SupabaseClient | null =
  url && serviceKey
    ? createClient(url, serviceKey, { auth: { persistSession: false } })
    : null;

export const SAVED_ITEMS = "saved_items";
