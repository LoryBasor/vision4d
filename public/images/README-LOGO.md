# 🖼️ Vision 4D — Intégration du Logo

## Fichiers à créer

Placez vos fichiers dans le dossier `public/images/` :

```
public/
└── images/
    ├── logo.png          ← Logo principal (fond transparent ou blanc)
    ├── logo-white.png    ← Logo version blanche (pour fonds sombres)
    └── favicon.ico       ← Icône onglet navigateur (32×32 px)
```

## Spécifications recommandées

| Fichier         | Dimensions | Fond          | Usage                          |
|-----------------|-----------|---------------|--------------------------------|
| `logo.png`      | 200×60 px  | Transparent   | Page login admin, footer       |
| `logo-white.png`| 200×60 px  | Transparent   | Navbar, sidebar admin, login   |
| `favicon.ico`   | 32×32 px   | Transparent   | Onglet navigateur              |

## Où le logo s'affiche

| Endroit                  | Fichier utilisé    |
|--------------------------|-------------------|
| Navbar (toutes les pages)| `logo-white.png`  |
| Sidebar admin            | `logo-white.png`  |
| Page connexion client    | `logo-white.png`  |
| Page inscription         | `logo-white.png`  |
| Page connexion admin     | `logo.png`        |
| Footer                   | `logo-white.png`  |
| Onglet navigateur        | `favicon.ico`     |
| Widget Monetbil          | `logo.png`        |
| Open Graph (partage)     | `logo.png`        |

## ⚠️ Fallback automatique

Si un fichier image est manquant, le texte **"Vision4D"** s'affiche automatiquement
à la place grâce à l'attribut `onerror` sur chaque balise `<img>`.
Vous pouvez donc déployer sans logo et l'ajouter plus tard sans casser l'affichage.

## Créer un logo rapide avec Canva

1. Aller sur [canva.com](https://canva.com)
2. Créer un design personnalisé : 600×180 px
3. Fond transparent
4. Couleurs : `#5CBFBE` (teal) et `#011826` (navy)
5. Exporter en PNG
6. Réduire à 200×60 px avec un outil comme [squoosh.app](https://squoosh.app)
7. Créer la version blanche pour `logo-white.png`

## Créer un favicon

Depuis votre `logo.png`, utilisez [favicon.io](https://favicon.io/favicon-converter/)
pour générer le `favicon.ico`.
