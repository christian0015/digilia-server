// controllers/aiController.js
const axios = require('axios');

// Importer User pour gérer quotas
const User = require('../models/User'); // <- déjà existant si pas, à ajouter
// Verifier l'existenceet la validite du token
const decodeToken = require('../utils/verifyToken');

// Librairie pour gérer les dates facilement
const moment = require('moment'); // npm i moment


// Liste des modèles disponibles et leur fallback si token insuffisant
const MODEL_FALLBACKS = {
    'claude-sonnet-4': 'claude-opus-4',
    'openai/gpt-oss-20B': 'llama-3.1-8b-instant',
    'llama-3.3-70B-versatile': 'llama-3.1-8b-instant',
    'openai/gpt-oss-120B': 'openai/gpt-oss-20B'
};

// Mapping du max tokens selon le modèle
const MAX_TOKENS_MAP = {
  'llama-3.1-8b-instant': 131072,
  'llama-3.3-70b-versatile': 131072,
  'openai/gpt-oss-120B': 65536,
  'openai/gpt-oss-20B': 65536
};

const digiliaSchema= [
    {
  "id": "string (unique id, généré automatiquement)",
  "name": "string (nom éditable par l’utilisateur, ne pas confondre avec l’id)",

  "elementType": "string (jsxElement | 3DElement)",

  "type": "string (balise JSX valide ou type 3D ex: div, nav, h1, p, button, model3D, mesh etc.)",

  "className": [
    "0 ou plus parmi: rotate, pulse, hover-perspective, perspective-track, circular-glow, advanced-card, border-glow, scale-hover, shadow-pop, float-y"
  ],

  "style": {
    "property": "value (CSS inline compatible), veillez sur l'auto responsivité"
  },
  "hoverStyle": {
    "property": "value (CSS inline compatible)"
  },

  "content": "string (texte affiché si applicable, ex: pour h1, p, button...)",

  "attributes": {
    "anyAttribute": "value (ex: data-aos, data-aos-duration et les autes data-aos...)"
  },

  "events": {
    "eventName": "handlerName (onClick, onHover, onScroll...)"
  },

  "asset": "string (obligatoire seulement pour 3DElement, doit être un des fichiers suivants: /models/abstract-doughnut.glb, /models/abstract-figure.glb, /models/bable.glb, /models/burger_merged.glb, /models/CanetteSchweppes.glb, /models/car-feature.glb, connecteurs.glb, /models/diamond.glb, /models/green_template.glb, /models/Helico.glb, /models/loop.glb, /models/multigeobjets.glb, /models/multigeometries.glb, /models/obgAnime.glb, /models/paradox_abstract_art_of_python.glb, /models/pink-d.glb, /models/abstract-ball.glb)",

  "material": {
    "type": "string (meshPhysical | meshTransmission | autre type supporté)",
    "properties": {}
  },

  "transform": {
    "position": [0, 0, 0],
    "rotation": [0, 0, 0],
    "scale": [1, 1, 1]
  },

  "animations": [
    {
      "type": "string (rotation | scale | sequence)",
      "trigger": "string (time | hover | click | scroll)",
      
      "loop": "boolean",
      "duration": "number (seconds)",

      "axis": "string (x | y | z, requis uniquement pour rotation simple)",

      "from": "valeur initiale (ex: angle pour rotation, vecteur [x,y,z] pour scale)",
      "to": "valeur finale (ex: angle, vecteur...)",

      "easing": "string (optionnel, ex: easeOutElastic)",

      "states": [
        {
          "scale": [1, 1, 1],
          "rotation": [0, 0, 0],
          "translation": [0, 0, 0],
          "duration": 1,
          "color": "#hex"
        }
      ]
    }
  ],

  "children": [
    { "sub-element": "nested structure (même schema)" }
  ],

  "plateforme": "boolean (ex: false si pas destiné à un device particulier)"
}

]


/**
 * Règles précises par style visuel. Ce ne sont pas des adjectifs vagues: ce sont
 * instructions à appliquer au rendu (typographie, spatials, couleurs, surfaces).
 * Ajoute de nouveaux styles facilement.
 */
const STYLE_RULES = {
  minimaliste: `STYLE: minimaliste
- Palette réduite (2-3 couleurs max). Espaces généreux. Typo nette.
- UI: boutons simples, bordures fines, pas d'ombre pesante.
- Cards: fond neutre, padding régulier; utiliser grid minimal.
`,
  moderne: `STYLE: moderne
- Typographies géométriques; espacement modéré; micro-animations au hover.
- Couleurs contrastées pour CTA. Use grid & asymétrie légère.
`,
  luxueux: `STYLE: luxueux
- Espacement large, typo élégante (serif/rounded), accents dorés ou violets.
- Photos lifestyle haute-res; reflets subtils; ombres douces.
`,
  glassmorphism: `STYLE: glassmorphism
- Surfaces translucides: background-color rgba + backdrop-filter: blur(8px).
- Utiliser border: 1px solid rgba(...,0.12) pour séparation.
- Eviter ombres lourdes; privilégier subtile glow sur hover.
- Buttons: semi-transparent with clear contrast text.
`,
  neomorphism: `STYLE: neomorphism
- Soft shadows: combinaison de light & dark shadows, surfaces légèrement convexes/concaves.
- Fond généralement monochrome doux; boutons en relief subtil.
- Eviter couleurs saturées fortes; privilégier tons pastel ou gris.
`,
  bento: `STYLE: bento-design
- Blocs structurés comme carrés/rectangles (gutter spacing).
- Cards with strong grid rhythm; asymetric layouts inside stable modules.
- Use bold labels, explicit CTAs, and consistent card sizes.
`
};

/**
 * Indications selon audience (ton, assets, microcopy).
 */
const AUDIENCE_HINTS = {
  'haut de gamme': `AUDIENCE: haut de gamme
- Ton: mesuré, confiant, valorisant.
- Assets: images premium, pas de stock cheap.
- Microcopy: court, axé valeur et garantie.
`,
  jeune: `AUDIENCE: jeune
- Ton direct, emojis optionnels, micro-interactions marquées.
- Colors: saturées, typographies plus exubérantes.
`,
  startup: `AUDIENCE: startup
- Ton orienté features & metrics, CTA business-focused.
- Use social proof and logos.
`,
  corporate: `AUDIENCE: corporate
- Ton formel, sections factuelles, palette neutre.
`
};
async function handleAICreation(req, res) {
    try {
        const {
            colors = [],
            description,
            type = null,
            typeSection = null,
            style = null,
            audience = null,
            fonts,
            language = 'fr',
            model = 'llama-3.1-8b-instant' // modèle par défaut si front ne précise rien
        } = req.body;

        if (!description) {
            return res.status(400).json({ error: "Description est obligatoire" });
        }

        // Préparer le prompt à envoyer à l'IA
        const styleRules = STYLE_RULES[style] || STYLE_RULES['ultra-professionnel'];
        const audienceHint = AUDIENCE_HINTS[audience] || '';

        // *************************** Verification Droit de generation ***************************
        // ****************************************************************************************
        // ****************************************************************************************
        // Récupérer l'utilisateur depuis le token (ex: Bearer token dans headers)
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: "Token manquant" });

        let userId;
        try {
            userId = decodeToken(token); // <- ta fonction existante generateToken / verify
        } catch {
            return res.status(401).json({ error: "Token invalide" });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

        // =================== RESET QUOTAS SI NOUVEAU JOUR ===================
        // On reset les dailyGenerations si la date est passée
        const today = moment().startOf('day');
        if (!user.lastReset || moment(user.lastReset).isBefore(today)) {
            user.dailyGenerations = 0;
            // Reset les quotas payants si nécessaire selon abonnement
            if (user.subscription.type === 'basic') user.paidGenerations = 20; // ex: 20/mois
            else if (user.subscription.type === 'premium') user.paidGenerations = 50; // ex: 50/mois
            user.lastReset = new Date();
            await user.save();
        }

        // =================== VERIFIER QUOTAS AVANT GENERATION ===================
        const isPaidRequest = req.body.usePaid || false; // ex: flag pour DeepSeek ou generation payante

        if (isPaidRequest) {
            if (user.paidGenerations <= 0) {
                return res.status(403).json({ error: "Quota payant épuisé" });
            }
        } else {
            if (user.dailyGenerations >= 15) { // ex: 5 sections/jour pour Free
                return res.status(403).json({ error: "Quota journalier atteint" });
            }
        }

        // =================== INCREMENTER LES QUOTAS ===================
        user.dailyGenerations += 1;
        if (isPaidRequest) user.paidGenerations -= 1;
        await user.save();

const prompt2 = {digiliaSchema,
            userData: {
                description,
                type,
                typeSection,
                style,
                fonts,
                audience, 
                colors,
                language
            }}
        const prompt = {
            instruction:  `
            Tu es un expert en développement front-end et en 3D, spécialisé sur le framework Digilia. 
            Ta mission est de générer une **landing page luxueuse, haut de gamme et immersive**, adaptée pour une première visite, similaire aux meilleurs sites premium comme Vercel et . 
            - Concentre-toi sur un **design fort et élégant**, avec typographie moderne, navigation minimaliste et expérience immersive. 
            - Utilise les **ressources 3D intelligemment** : modèles essentiels, animations pertinentes, reflets réalistes, lumière et caméra dynamique, sans duplication inutile pour préserver la performance. 
            - Les animations doivent être **cohérentes et ciblées** : appliquer className et data-aos uniquement sur les éléments qui le méritent (texte lisible ou objets visuels, jamais sur divs parent inutiles). 
            - Chaque section doit avoir une logique claire : début et fin visibles, hiérarchie cohérente, conversion facilitée, texte attratif et oriente conversion (sauf pour les descriptions 3-100 mots), visuels pertinents et interactifs. 
            - Prévois les fonctionnalités typiques : hero avec CTA( header( flex wramp j-betw et padd l-r pour l'espace contien logo ou nom site + nav (/+ 0-2 button appel à action)), titre, description, Appel à l'action, img ou 3D( index 0, minW 400px, width 100%, (donc en dessous de tout les autres elts du hero) )), about(titre, description img), si e-com fait product( une enoncé + card(block ou flex) avec classname pour chacun img, (titre, description button)), pricing(3-4 offres avec des specificite liees au domains), best seller(( une enoncé + card(flex) avec classname sur img ou button; avoir img, (titre, description button))), témoignages(( une enoncé card(flex) avec classname pour chacun (img + nom user), (texte + note))), formulaire( pour avis ), FAQ (question pertinente), info (Form newsletter), footer (logo ou nom site, info dev, liens reseau sociaux, copyrith et politic ). 
            - Vérifie que chaque image ou asset est adapté et optimisé.
            - Pour chaque contenaire qui contient des elements dans son children toujours preciser dans le display(block/flex/grid etc), pour flex ne pas oublier le gap. Et pour les grandes sections minHeight 100vh.
            - Utilise des imgs directe sur internet, unplash etc sinon utilise https://mir-s3-cdn-cf.behance.net/project_modules/1400/2411cd212698699.6739e4f591f43.png -- pour video aussi sinon utiluse https://youtu.be/WICsXLwzCSc
            - Tu es obliger d'appliquer un font a tout texte, selon les users
            -Veille a la lisibilite de chaque texte
            -${styleRules} 
            -${audienceHint}
            Respecte **strictement le schéma Digilia** fourni : id, name, elementType, type, className, style, content, attributes, events, asset, material, transform, animations, children, plateforme.
            - Non obligation et si vide mieux ne pas mentionner: className, style, content, attributes, events, asset, material, transform, animations, children, plateforme.
            - Reflechir avant utilisation : className, style, attributes, NB: Ne pas appliquer className sur grand element (ex: >500px) comme DIV ou texte.
            Toutes les valeurs doivent correspondre au type attendu. **Ne génère pas de texte explicatif**.

            `,
            instructionFinale:  `
            Génère la **structure JSON complète Digilia** correspondant aux informations ci-dessus. **Rien d’autre que le JSON: {id ...}**. Répond uniquement avec du JSON valide conforme au schéma Digilia. Ne mets aucun texte explicatif.
            `       
        };

        let chosenModel = model in MODEL_FALLBACKS ? model : 'llama-3.1-8b-instant';

        let response;
        try {
            response = await queryAI(prompt, chosenModel, prompt2);
        } catch (err) {
            // Si erreur (ex: modèle à court de tokens), on bascule sur le fallback
            const fallbackModel = MODEL_FALLBACKS[chosenModel] || 'llama-3.1-8b-instant';
            response = await queryAI(prompt, fallbackModel, prompt2);
            chosenModel = fallbackModel;
        }

        res.json({
            modelUsed: chosenModel,
            data: response,
            quota: {
            dailyUsed: user.dailyGenerations,
            dailyRemaining: 5 - user.dailyGenerations, // ou ton quota Free
            paidUsed: user.subscription.type !== 'free' ? (user.subscription.type === 'basic' ? 20 - user.paidGenerations : 50 - user.paidGenerations) : 0,
            paidRemaining: user.paidGenerations
          }
        });

    } catch (error) {
        // console.error(error);
        res.status(500).json({ error: "Erreur serveur" });
    }
}

/**
 * Fonction pour interroger l'API IA
 */
async function queryAI(promptData, model, prompt2) {
    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions'; // Exemple Groq
    const apiKey = process.env.GROQ_API_KEY;
    console.log("*****PromptData*****:" ,promptData);
    
    const body = {
        model: model,
        messages: [
            { role: 'system', content: JSON.stringify(promptData) },
            { role: 'user', content: JSON.stringify(prompt2) }
            // { role: 'user', content: promptData.instruction + "\n" + JSON.stringify(promptData.userData) }

        ],
        max_tokens: MAX_TOKENS_MAP[model]
    };

    const response = await axios.post(apiUrl, body, {
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    });


    console.log(response);
        
    const rawContent = response.data?.choices?.[0]?.message?.content;

    if (!rawContent) {
    return { error: "Aucune réponse de l'IA" };
    }

    // Supprime les ```json et ```
    const cleanedContent = rawContent.replace(/^```json\s*/, '').replace(/```$/, '');

    let jsonData;
    try {// Si ça commence par [ on force à prendre le premier élément
    if (cleanedContent.trim().startsWith("[")) {
      const parsedArray = JSON.parse(cleanedContent);
      jsonData = Array.isArray(parsedArray) ? parsedArray[0] : parsedArray;
    } else {
      jsonData = JSON.parse(cleanedContent);
    }
      // jsonData = JSON.parse(cleanedContent);
      console.log(`Reponse API: ********************* ${JSON.stringify(jsonData, null, 2)} *******************`);
      
    } catch (e) {
      return { error: "Réponse IA invalide (non JSON)" };
    }
    return jsonData;


    // Retourner juste le contenu texte
    return response.data.choices[0].message.content;
}

module.exports = { handleAICreation };
