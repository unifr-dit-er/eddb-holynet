# EDDB Simplemap - Documentation

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Installation et démarrage](#installation-et-démarrage)
3. [Configuration](#configuration)
   - [Structure générale](#structure-générale)
   - [Paramètres de l'application](#paramètres-de-lapplication)
   - [Configuration de l'API](#configuration-de-lapi)
   - [Propriétés et filtres](#propriétés-et-filtres)
   - [Configuration du popup](#configuration-du-popup)
   - [Configuration de la carte](#configuration-de-la-carte)
   - [Menu de filtres](#menu-de-filtres)
   - [Mode debug](#mode-debug)
5. [Guide des filtres](#guide-des-filtres)
6. [Propriétés relationnelles](#propriétés-relationnelles)
7. [Personnalisation de la page About](#personnalisation-de-la-page-about)
8. [Exemples de configuration](#exemples-de-configuration)
9. [Conseils et bonnes pratiques](#conseils-et-bonnes-pratiques)
10. [Mise en production](#mise-en-production)
11. [Support et contribution](#support-et-contribution)

---

## Vue d'ensemble

EDDB Simplemap est une application de cartographie interactive qui affiche des points géographiques provenant d'une API NocoDB. L'application offre :

- **Carte interactive** avec Leaflet
- **Clustering automatique** des marqueurs
- **Système de filtres flexible** (filtres standards et booléens)
- **Popups personnalisables** avec images et markdown
- **Configuration centralisée** dans un seul fichier
- **Support des relations de base de données**
- **Page About personnalisable** par application

---

## Installation et démarrage

```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev
```

L'application sera accessible à l'adresse indiquée dans le terminal (généralement `http://localhost:5173`).

---

## Configuration

### Structure générale

Toute la configuration se trouve dans le fichier `src/config.ts`. La structure de base est :

```typescript
export const config: AppConfig = {
  appName: string,
  apiUrl: string,
  apiToken: string,
  geoDataField: string,
  properties: PropertyConfig[],
  debug: DebugConfig,
  map: MapConfig,
  popup: PopupConfig,
  filterMenu: FilterMenuConfig,
  eddbServiceUrl: string
}
```

### Paramètres de l'application

#### `appName` (string)
Le nom de votre application affiché dans l'en-tête.

```typescript
appName: 'Ludus'
```

**Note :** Ce nom est aussi utilisé pour charger automatiquement :
- Le fichier markdown correspondant dans `src/about/` (ex: `Ludus.md`)
- L'image correspondante dans `src/about/` (ex: `ludus.png`)

#### `eddbServiceUrl` (string)
L'URL de base du service EDDB utilisée dans les liens.

```typescript
eddbServiceUrl: 'https://eddb.unifr.ch'
```

### Configuration de l'API

#### `apiUrl` (string)
L'URL complète de l'endpoint NocoDB pour récupérer les enregistrements.

```typescript
apiUrl: 'https://eddb.unifr.ch/noco/api/v2/tables/mw4mvjms6nkuq0f/records'
```

#### `apiToken` (string)
Le token d'authentification pour l'API NocoDB.

```typescript
apiToken: 'hCmfVFzK4mpjHkyLJzD1U2plqzJInYmdhzQ8NrzR'
```

#### `geoDataField` (string)
Le nom du champ contenant les coordonnées géographiques au format "lat;lng".

```typescript
geoDataField: 'GeoData'
```

### Propriétés et filtres

Le tableau `properties` est l'élément central de la configuration. Il définit simultanément :
- Les champs affichés dans les popups
- Les labels de ces champs
- Les filtres disponibles

#### Structure d'une propriété

```typescript
interface PropertyConfig {
  field: string           // Nom du champ dans l'API
  label?: string          // Label affiché (optionnel, utilise field par défaut)
  path?: string           // Chemin pour les propriétés relationnelles (optionnel)
  filter: FilterType | null  // Configuration du filtre ou null pour pas de filtre
}
```

#### Types de filtres

##### 1. Filtre standard
Crée une liste de cases à cocher avec toutes les valeurs uniques du champ.

```typescript
{
  field: 'Material',
  label: 'Matériel',
  filter: {
    type: 'standard',
    shortLabel: 'Mat.'    // Optionnel : label court pour les onglets
  }
}
```

**Fonctionnalités :**
- Collecte automatique de toutes les valeurs uniques
- Comptage du nombre d'occurrences par valeur
- Gestion des valeurs vides (affichées comme "Unknown")
- Boutons "All" et "None" pour sélection rapide

##### 2. Filtre booléen
Crée un interrupteur on/off pour des conditions spécifiques.

```typescript
{
  field: 'Image',
  label: 'A des images',
  filter: {
    type: 'boolean',
    checkFunction: (record) => {  // Optionnel : fonction personnalisée
      return record.Image && Array.isArray(record.Image) && record.Image.length > 0
    }
  }
}
```

Si `checkFunction` n'est pas fourni, le filtre vérifie simplement : `!!record[field]`

##### 3. Pas de filtre
Pour afficher une propriété sans possibilité de filtrage.

```typescript
{
  field: 'Description',
  label: 'Description',
  filter: null
}
```

#### Ordre d'affichage

L'ordre de déclaration dans le tableau `properties` détermine :
1. L'ordre d'affichage des propriétés dans les popups
2. L'ordre des filtres dans l'interface

#### Champs exclus automatiquement

Les champs suivants ne sont jamais affichés dans les popups même s'ils sont dans l'API :
- Le champ défini dans `geoDataField`
- `Id`
- Le champ défini dans `popup.titleField`
- `CreatedAt`
- `UpdatedAt`

#### Traitements spéciaux

##### Locations
Les champs `Location1`, `Location2`, et `Location3` sont automatiquement groupés et affichés comme "Locations" (séparés par des virgules).

##### PleiadesId
Automatiquement converti en lien vers Pleiades : `https://pleiades.stoa.org/places/{id}`

##### Markdown
Toutes les valeurs de propriétés sont parsées et affichées en Markdown.

##### Images
Si un champ `popup.imageField` est défini et contient des images, elles sont affichées en bas du popup. Les URLs d'images sont automatiquement mises en cache car elles sont temporaires.

### Configuration du popup

```typescript
popup: {
  titleField: string,      // Champ utilisé comme titre
  width?: number,          // Largeur en pixels (défaut: 300)
  imageField?: string      // Champ contenant les images (optionnel)
}
```

#### Exemple

```typescript
popup: {
  titleField: 'Title',
  width: 400,
  imageField: 'Image'
}
```

Le champ image doit suivre la structure NocoDB :
```
Image > thumbnails > card_cover > signedPath
```

L'URL sera automatiquement préfixée avec `https://eddb.unifr.ch/noco/`.

### Configuration de la carte

```typescript
map: {
  defaultCenter: [number, number],  // [latitude, longitude]
  defaultZoom: number,               // Niveau de zoom (1-20)
  clusterRadius: number,             // Rayon de clustering en pixels
  markerColors?: {
    field: string                    // Champ utilisé pour colorer les points
  }
}
```

#### Exemple

```typescript
map: {
  defaultCenter: [46.8, 8.2],
  defaultZoom: 8,
  clusterRadius: 50,
  markerColors: {
    field: 'TimeOfEmergence'
  }
}
```

#### Couleurs des points par champ

Si `map.markerColors.field` est défini, chaque valeur distincte de ce champ reçoit automatiquement une couleur différente.

- Les couleurs sont générées automatiquement avec un espacement fort pour rester distinguables.
- Les valeurs vides sont regroupées dans la catégorie `Unknown`.
- Pour les champs multi-valeurs, la première valeur non vide est utilisée pour choisir la couleur.

### Menu de filtres

Vous pouvez choisir entre deux types d'interface pour les filtres :

```typescript
filterMenu: {
  type: 'dropdown' | 'tabs'
}
```

#### Type : Dropdown (recommandé pour 5+ filtres)
Menu déroulant compact qui permet de sélectionner le filtre à afficher.

**Avantages :**
- Prend moins d'espace
- Meilleur pour de nombreux filtres
- Interface plus épurée

```typescript
filterMenu: {
  type: 'dropdown'
}
```

#### Type : Tabs (recommandé pour 2-5 filtres)
Affiche tous les filtres sous forme d'onglets visibles.

**Avantages :**
- Accès direct à tous les filtres
- Visualisation immédiate des états
- Utilise les `shortLabel` pour des onglets compacts

```typescript
filterMenu: {
  type: 'tabs'
}
```

**Astuce :** Les `shortLabel` dans la configuration des filtres sont particulièrement utiles avec le type `tabs` pour garder les onglets compacts.

### Mode debug

```typescript
debug: {
  enabled: boolean,         // Affiche le bouton Debug dans l'interface
  showConsoleLog: boolean   // Active les logs console
}
```

#### Exemple

```typescript
debug: {
  enabled: true,            // En développement
  showConsoleLog: true
}

// En production :
debug: {
  enabled: false,
  showConsoleLog: false
}
```

Le bouton Debug affiche la réponse brute de l'API pour faciliter le développement.

---

## Guide des filtres

### Logique de filtrage

1. **Filtres standard** :
   - Un point doit correspondre à au moins une valeur sélectionnée
   - Si aucune valeur n'est sélectionnée, aucun point n'est affiché

2. **Filtres booléens** :
   - Un point doit passer la vérification quand le filtre est activé
   - Quand désactivé, tous les points passent

3. **Logique AND entre filtres** :
   - Tous les filtres actifs sont appliqués ensemble
   - Un point doit satisfaire TOUS les filtres pour être affiché

### Boutons de contrôle

- **"All" / "None"** : Dans chaque filtre standard (onglet)
- **"Reset all filters"** : En haut de l'interface, réinitialise tous les filtres

### Compteurs

- Chaque option de filtre affiche le nombre de points correspondants
- Le compteur dans l'en-tête affiche le nombre total de points affichés (après filtrage)

### Exemples de configuration

#### Plusieurs filtres standard

```typescript
properties: [
  {
    field: 'Material',
    label: 'Matériel',
    filter: { type: 'standard' }
  },
  {
    field: 'Morphology',
    label: 'Morphologie',
    filter: { type: 'standard', shortLabel: 'Morph.' }
  },
  {
    field: 'Game',
    label: 'Jeu',
    filter: { type: 'standard' }
  }
]
```

#### Mix de filtres

```typescript
properties: [
  {
    field: 'Status',
    label: 'Statut',
    filter: { type: 'standard' }
  },
  {
    field: 'Image',
    label: 'A des images',
    filter: { type: 'boolean' }
  },
  {
    field: 'Description',
    label: 'Description',
    filter: null  // Affichage uniquement
  }
]
```

#### Aucun filtre

```typescript
properties: []
```

L'interface s'adapte automatiquement et n'affiche pas le bouton de filtres.

---

## Propriétés relationnelles

Les propriétés relationnelles permettent d'accéder à des données imbriquées dans des relations de base de données (comme les relations many-to-many de NocoDB).

### Configuration

Utilisez le paramètre `path` pour définir le chemin d'accès aux données relationnelles :

```typescript
{
  field: 'Circuits',                    // Nom unique de la propriété
  label: 'Circuits associés',           // Label affiché
  path: '_nc_m2m_Sites_Circuits.Circuits.Denomination',  // Chemin vers les données
  filter: {
    type: 'standard',
    shortLabel: 'Circuits'
  }
}
```

### Fonctionnement du chemin (path)

Le chemin utilise la notation par points pour naviguer dans les objets et tableaux imbriqués.

#### Exemple 1 : Relation simple

```javascript
// Structure de données API :
{
  "_nc_m2m_Sites_Circuits": [
    {
      "Circuits": {
        "Denomination": "Circuit A"
      }
    },
    {
      "Circuits": {
        "Denomination": "Circuit B"
      }
    }
  ]
}

// Configuration :
path: '_nc_m2m_Sites_Circuits.Circuits.Denomination'

// Résultat extrait : ["Circuit A", "Circuit B"]
```

#### Exemple 2 : Tableaux imbriqués multiples

```javascript
// Structure de données :
{
  "Categories": [
    {
      "Items": [
        { "Name": "Item 1" },
        { "Name": "Item 2" }
      ]
    },
    {
      "Items": [
        { "Name": "Item 3" }
      ]
    }
  ]
}

// Configuration :
path: 'Categories.Items.Name'

// Résultat : ["Item 1", "Item 2", "Item 3"]
```

### Affichage et filtrage

- **Dans les popups** : Les valeurs multiples sont jointes par des virgules
- **Dans les filtres** : Chaque valeur unique devient une option de filtre
- **Valeurs vides** : Gérées comme "Unknown"

### Exemples d'utilisation

#### Relation many-to-many (NocoDB)

```typescript
{
  field: 'AssociatedCircuits',
  label: 'Circuits',
  path: '_nc_m2m_Sites_Circuits.Circuits.Denomination',
  filter: { type: 'standard' }
}
```

#### Relation one-to-many

```typescript
{
  field: 'Comments',
  label: 'Commentaires',
  path: 'Comments.Text',
  filter: null
}
```

#### Propriété calculée imbriquée

```typescript
{
  field: 'FullNames',
  label: 'Noms complets',
  path: 'Users.Profile.FullName',
  filter: { type: 'standard' }
}
```

### Notes importantes

- **Compatibilité** : Le paramètre `path` est optionnel. Sans lui, le système utilise directement `field`
- **Performance** : Les chemins complexes avec de nombreux tableaux peuvent impacter les performances
- **Debug** : Utilisez le mode debug pour visualiser la structure exacte de vos données API

---

## Personnalisation de la page About

La page About est automatiquement générée en fonction du `appName` configuré.

### Fichiers requis

Placez les fichiers dans le dossier `src/about/` :

1. **Fichier Markdown** : `{appName}.md` (ex: `Ludus.md`)
2. **Image** (optionnel) : `{appName}.png` ou `{appName}.jpg` (ex: `ludus.png`)

### Exemple de structure

```
src/
  about/
    Ludus.md
    ludus.png
    Holynet.md
    holynet.png
```

### Contenu du fichier Markdown

Le fichier markdown peut contenir :
- Titres (`#`, `##`, etc.)
- Paragraphes
- Listes
- Liens
- Formatage (gras, italique, code)

Exemple (`Ludus.md`) :

```markdown
# Ludus

## Description

Ludus est une application de cartographie interactive...

## Fonctionnalités

- Visualisation de points sur une carte
- Filtres multiples
- Support des images

## Contact

Pour plus d'informations : [eddb.unifr.ch](https://eddb.unifr.ch)
```

### Affichage

- Le titre du modal est masqué (pour éviter la redondance avec le contenu)
- Le modal est plus large que les modals standard
- L'image (si présente) est affichée en haut du contenu
- Le bouton About utilise la couleur primaire pour se distinguer

---

## Exemples de configuration

### Configuration minimale

```typescript
export const config: AppConfig = {
  appName: 'Ma Carte',
  apiUrl: 'https://api.example.com/records',
  apiToken: 'mon-token',
  geoDataField: 'Coordinates',
  
  properties: [
    {
      field: 'Name',
      filter: null
    }
  ],
  
  popup: {
    titleField: 'Name'
  },
  
  map: {
    defaultCenter: [46.8, 8.2],
    defaultZoom: 8,
    clusterRadius: 50
  },
  
  filterMenu: {
    type: 'dropdown'
  },
  
  debug: {
    enabled: false,
    showConsoleLog: false
  },
  
  eddbServiceUrl: 'https://eddb.unifr.ch'
}
```

### Configuration complète (exemple Ludus)

```typescript
export const config: AppConfig = {
  appName: 'Ludus',
  apiUrl: 'https://eddb.unifr.ch/noco/api/v2/tables/mw4mvjms6nkuq0f/records',
  apiToken: 'hCmfVFzK4mpjHkyLJzD1U2plqzJInYmdhzQ8NrzR',
  geoDataField: 'GeoData',
  
  properties: [
    {
      field: 'TownVillage',
      label: 'Town / Village',
      filter: null
    },
    {
      field: 'Material',
      label: 'Material',
      filter: {
        type: 'standard',
        shortLabel: 'Mat.'
      }
    },
    {
      field: 'Morphology',
      label: 'Morphology',
      filter: {
        type: 'standard',
        shortLabel: 'Morph.'
      }
    },
    {
      field: 'Game',
      label: 'Game',
      filter: { type: 'standard' }
    },
    {
      field: 'ConservationState',
      label: 'Conservation State',
      filter: {
        type: 'standard',
        shortLabel: 'State'
      }
    },
    {
      field: 'Typology',
      label: 'Typology',
      filter: { type: 'standard' }
    },
    {
      field: 'TypologySurroundingEnvironment',
      label: 'Typology / Surrounding Environment',
      filter: {
        type: 'standard',
        shortLabel: 'Surrounding Env.'
      }
    },
    {
      field: 'Circuits',
      label: 'Circuits',
      path: '_nc_m2m_Sites_Circuits.Circuits.Denomination',
      filter: {
        type: 'standard',
        shortLabel: 'Circuits'
      }
    },
    {
      field: 'PleiadesId',
      label: 'Pleiades ID',
      filter: null
    },
    {
      field: 'Image',
      label: 'Has Images',
      filter: {
        type: 'boolean',
        checkFunction: (record) => {
          return record.Image && Array.isArray(record.Image) && record.Image.length > 0
        }
      }
    }
  ],
  
  popup: {
    titleField: 'Title',
    width: 400,
    imageField: 'Image'
  },
  
  map: {
    defaultCenter: [46.8, 8.2],
    defaultZoom: 8,
    clusterRadius: 50
  },
  
  filterMenu: {
    type: 'dropdown'
  },
  
  debug: {
    enabled: true,
    showConsoleLog: true
  },
  
  eddbServiceUrl: 'https://eddb.unifr.ch'
}
```

### Configuration avec relations multiples

```typescript
export const config: AppConfig = {
  appName: 'Holynet',
  apiUrl: 'https://eddb.unifr.ch/noco/api/v2/tables/autre-table/records',
  apiToken: 'token-holynet',
  geoDataField: 'GeoData',
  
  properties: [
    {
      field: 'Name',
      label: 'Nom',
      filter: null
    },
    {
      field: 'Type',
      label: 'Type',
      filter: { type: 'standard' }
    },
    {
      field: 'AssociatedSites',
      label: 'Sites associés',
      path: '_nc_m2m_Items_Sites.Sites.Name',
      filter: { type: 'standard', shortLabel: 'Sites' }
    },
    {
      field: 'Categories',
      label: 'Catégories',
      path: 'Categories.Name',
      filter: { type: 'standard', shortLabel: 'Cat.' }
    },
    {
      field: 'Verified',
      label: 'Vérifié uniquement',
      filter: { type: 'boolean' }
    }
  ],
  
  popup: {
    titleField: 'Name',
    width: 450,
    imageField: 'Photos'
  },
  
  map: {
    defaultCenter: [47.5, 7.5],
    defaultZoom: 9,
    clusterRadius: 60
  },
  
  filterMenu: {
    type: 'tabs'  // Utilise des onglets pour un accès rapide
  },
  
  debug: {
    enabled: false,
    showConsoleLog: false
  },
  
  eddbServiceUrl: 'https://eddb.unifr.ch'
}
```

---

## Conseils et bonnes pratiques

### Configuration générale

1. **En production** : Désactivez le mode debug (`enabled: false`, `showConsoleLog: false`)
2. **Labels courts** : Utilisez `shortLabel` pour des onglets compacts (surtout avec `filterMenu: { type: 'tabs' }`)
3. **Ordre des propriétés** : Placez les propriétés les plus importantes en premier
4. **Nommage** : Utilisez des labels descriptifs et compréhensibles par les utilisateurs

### Filtres

1. **Nombre de filtres** :
   - 0-2 filtres : Type `tabs` recommandé
   - 3-5 filtres : Les deux types fonctionnent bien
   - 5+ filtres : Type `dropdown` recommandé

2. **Types de filtres** :
   - Utilisez `standard` pour des valeurs multiples discrètes
   - Utilisez `boolean` pour des conditions oui/non
   - Utilisez `null` pour les champs descriptifs sans besoin de filtre

3. **Performance** : Évitez d'avoir trop de filtres actifs simultanément

### Relations

1. **Vérification** : Utilisez le mode debug pour vérifier la structure exacte de vos données
2. **Performance** : Les chemins trop profonds peuvent ralentir l'application
3. **Nommage** : Donnez des noms de `field` descriptifs même si le `path` est complexe

### Popup

1. **Largeur** : Ajustez `width` en fonction de la quantité d'information affichée
2. **Images** : Vérifiez que le champ image contient bien la structure attendue par NocoDB
3. **Markdown** : Profitez du support Markdown pour formatter les descriptions

---

## Mise en production

- Adapter le titre dans `index.html`
- Copier la configuration `config.projet.ts` dans `config.ts`
- Configurer la base dans `vite.config.ts`

---

## Support et contribution

Pour toute question ou contribution, consultez le dépôt du projet ou contactez l'équipe EDDB.

**URL du service** : https://eddb.unifr.ch
