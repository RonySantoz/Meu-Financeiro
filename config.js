// ============================================================
//  CONFIGURAÇÃO DO SUPABASE
//  1) Crie um projeto gratuito em https://supabase.com
//  2) Vá em Project Settings > API Keys
//  3) Copie a "Publishable key" (sb_publishable_...) e cole abaixo.
//     A URL é https://SEU_ID.supabase.co (o SEU_ID aparece no endereço do painel).
//  A Publishable key é segura no navegador — a proteção vem das políticas RLS
//  do schema.sql. NUNCA use a "Secret key" (sb_secret_...) aqui.
//  Obs: o nome SUPABASE_ANON_KEY é só o nome interno da variável; o valor é a Publishable key.
// ============================================================
window.SUPABASE_URL = "https://mgrdppjivibwlwwmbhyr.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_EJ3RfSwrgSiUASm8jum0uQ_AsBBUsGK";

// ------------------------------------------------------------
//  LOGIN SÓ COM E-MAIL
//  A senha é gerada a partir do seu e-mail + esta frase secreta.
//  Troque por uma frase qualquer (quanto mais longa/aleatória, melhor).
//  Não mude depois de começar a usar, senão o login muda.
// ------------------------------------------------------------
window.APP_SECRET = "Aadreamer1@";

// ------------------------------------------------------------
//  COTAÇÕES (opcional)
//  Ações/FIIs brasileiros usam a API gratuita brapi.dev.
//  O plano gratuito pode pedir um token. Crie um grátis em
//  https://brapi.dev/dashboard e cole abaixo. Deixe "" para tentar sem token.
//  Cripto usa CoinGecko (sem token).
// ------------------------------------------------------------
window.BRAPI_TOKEN = "";
