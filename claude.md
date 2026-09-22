# CLAUDE.md

## Projet

Signal est une app web personnelle de curation culturelle.

Objectif :
chaque semaine, présenter uniquement des contenus culturels qui méritent vraiment du temps :
films, séries, albums, livres.

Positionnement :
**“Qu’est-ce que je ne dois pas rater ?”**

Signal n’est pas un catalogue infini, ni un clone de Netflix, ni une app de recommandations moyennes.

## Philosophie produit

L’utilisateur est exigeant, critique, et n’a pas de temps à perdre.

L’app doit privilégier :

- les valeurs sûres
- les contenus salués par critiques et spectateurs
- les œuvres avec une vraie réputation
- les contenus récents ou redécouverts
- les recommandations argumentées

L’app doit éviter :

- les productions génériques
- les contenus “algorithmiques”
- les films/séries cheap
- les recommandations trop nombreuses
- les interfaces type catalogue
- les textes marketing vagues

## Ton éditorial

Le ton doit être :

- direct
- exigeant
- clair
- humain
- utile
- critique

Chaque recommandation doit répondre à 2 questions :

1. Pourquoi c'est recommandé ?
2. De quoi ca parle et quel est le synopsis ?

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- TMDb API pour films/séries
- Architecture extensible pour musique et livres

## UI

Style attendu :

- premium
- sobre
- sombre
- dense mais lisible
- éditorial
- pas “Netflix-like”

Palette :

- fond : noir / presque noir
- cartes : anthracite
- texte : blanc cassé
- accent : rouge/corail
- détails secondaires : gris doux

## Fonctionnalités MVP

Pages :

- landing page
- dashboard hebdomadaire

Sections du dashboard :

- Films
- Séries
- Albums
- Livres
- Bonus / pépite ancienne

Chaque carte affiche :

- titre
- année
- catégorie
- genres
- score global
- score critiques
- score public
- popularité
- durée ou format
- image/poster
- disponibilité streaming
- pourquoi c’est une valeur sûre
- pourquoi ça pourrait ne pas plaire
- bouton “À voir”
- bouton “Pas pour moi”

## Scoring

Score global initial :

```ts
scoreGlobal =
  critique * 0.35 +
  public * 0.25 +
  popularite * 0.15 +
  reputation * 0.15 +
  compatibilite * 0.1;
```
