# Tickets contrats P1 (suivi léger)

## TKT-P1-LIMIT-HTTP-VS-S13-001 — Tension HTTP 64 Mo vs S13 80 Mo

| Champ | Valeur |
|-------|--------|
| **Statut** | Ouvert (2026-07-23) — suivi ; **pas de correctif dans le lot contrats export/apply** |
| **Priorité** | Basse (edge case image annotation très lourde) |
| **Contexte** | `pdf_service.MAX_POST_BODY_BYTES` = **64 Mo** (HTTP 413) ; S13 / `_decode_annotation_image_base64` = **80 Mo** |
| **Risque** | Un `src_base64` entre 64 et 80 Mo est refusé au HTTP **avant** S13 |
| **Hors scope immédiat** | JSON Schema P1 (S13 reste hors schéma) |
| **Action ultérieure** | Aligner plafonds (HTTP ≥ 80 Mo **ou** S13 ≤ 64 Mo) + tests ; arbitrage Matt |

Mirror local aussi dans `docs/06-Test-Matrix.md` (hors dépôt git).
