// controllers/aiController.js
const axios = require('axios');
const User = require('../models/User');
const decodeToken = require('../utils/verifyToken');
const { checkQuota, applyQuota } = require('../utils/quotaManager');
const moment = require('moment');

// Liste des modèles disponibles et leur fallback
const MODEL_FALLBACKS = {
    'claude-opus-4': 'claude-opus-4',
    'claude-sonnet-4': 'claude-sonnet-4',
    'openai/gpt-oss-120B': 'openai/gpt-oss-120B',
    'openai/gpt-oss-20B': 'openai/gpt-oss-20B',
    'llama-3.3-70B-versatile': 'llama-3.1-8b-instant'
};

// Mapping du max tokens selon le modèle
const MAX_TOKENS_MAP = {
    'llama-3.1-8b-instant': 131072,
    'llama-3.3-70b-versatile': 131072,
    'openai/gpt-oss-120B': 65536,
    'openai/gpt-oss-20B': 65536
};

const digiliaSchema = [
    {
        "id": "string (unique id, généré automatiquement)",
        "name": "string (nom éditable par l'utilisateur, ne pas confondre avec l'id)",
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
];

// Règles précises par style visuel
const STYLE_RULES = {
    minimaliste: `STYLE: minimaliste
- Palette réduite (2-3 couleurs max). Espaces généreux. Typo nette.
- UI: boutons simples, bordures fines, pas d'ombre pesante.
- Cards: fond neutre, padding régulier; utiliser grid minimal.`,
    moderne: `STYLE: moderne
- Typographies géométriques; espacement modéré; micro-animations au hover.
- Couleurs contrastées pour CTA. Use grid & asymétrie légère.`,
    luxueux: `STYLE: luxueux
- Espacement large, typo élégante (serif/rounded), accents dorés ou violets.
- Photos lifestyle haute-res; reflets subtils; ombres douces.`,
    glassmorphism: `STYLE: glassmorphism
- Surfaces translucides: background-color rgba + backdrop-filter: blur(8px).
- Utiliser border: 1px solid rgba(...,0.12) pour séparation.
- Eviter ombres lourdes; privilégier subtile glow sur hover.
- Buttons: semi-transparent with clear contrast text.`,
    neomorphism: `STYLE: neomorphism
- Soft shadows: combinaison de light & dark shadows, surfaces légèrement convexes/concaves.
- Fond généralement monochrome doux; boutons en relief subtil.
- Eviter couleurs saturées fortes; privilégier tons pastel ou gris.`,
    bento: `STYLE: bento-design
- Blocs structurés comme carrés/rectangles (gutter spacing).
- Cards with strong grid rhythm; asymetric layouts inside stable modules.
- Use bold labels, explicit CTAs, and consistent card sizes.`
};

// Indications selon audience
const AUDIENCE_HINTS = {
    'haut de gamme': `AUDIENCE: haut de gamme
- Ton: mesuré, confiant, valorisant.
- Assets: images premium, pas de stock cheap.
- Microcopy: court, axé valeur et garantie.`,
    jeune: `AUDIENCE: jeune
- Ton direct, emojis optionnels, micro-interactions marquées.
- Colors: saturées, typographies plus exubérantes.`,
    startup: `AUDIENCE: startup
- Ton orienté features & metrics, CTA business-focused.
- Use social proof and logos.`,
    corporate: `AUDIENCE: corporate
- Ton formel, sections factuelles, palette neutre.`
};

// Types de sections disponibles
const SECTION_TYPES = [
    "hero", "about", "features", "pricing", "testimonial", "contact", "custom"
];

// Prompts par type de section
const SECTION_PROMPTS = {
    hero: `SECTION HERO - Premier impact visuel
- Objectif: Capturer l'attention immédiate, valeur proposition claire
- Éléments requis: Header({flex wramp j-btw et padd l-r pour l'espace}; contien logo ou siteName + nav (+ 0-2 button appel à action)){peut se trouver etre en haut(fixed ou non)(margin 0 ou X px, Y px)/en bas(espacé du bas pour eviter de coller lècran ou cacher)}, 
    hero({soit en flex-wramp ou block si on a un visuel en arriere plan(hero sera relatif sans overflow, et le visuel en absolute, centré, sans contrainte hidden)}contien Textes( Titre percutant (h1), sous-titre accrocheur, CTA principal(1-2 elemt), visuel impactant (3D/image))
- Disposition: Layout moderne avec titre à gauche/centre, visuel à droite/fond
- Typographie: Titre en police forte, sous-titre lisible
- Interactions: AOS animation sur tout, Animations subtiles au scroll/hover sur CTA
- 3D: Modèle principal centré, rotation lente ou animation d'entrée`,

    about: `SECTION ABOUT - Présentation authentique
- Objectif: Établir confiance et connexion émotionnelle
- Éléments: Titre évocateur, texte narratif, valeurs/mission, visuel humain/authentique
- Disposition: Texte et image côte à côté ou alternés
- Ton: Chaleureux, personnel, authentique
- 3D: Élément symbolique discret si pertinent`,

    features: `SECTION FEATURES - Valeurs fonctionnelles
- Objectif: Démontrer l'utilité concrète
- Éléments: Grille de 3-6 features avec icône/titre/description
- Disposition: Grille responsive, cartes avec ombres/micro-interactions
- Interactions: Hover effects sur les cartes, animations au scroll
- 3D: Icônes 3D interactives pour chaque feature`,

    pricing: `SECTION PRICING - Offres commerciales
- Objectif: Présenter clairement les options et encourager l'action
- Éléments: 3-4 plans avec avantages, pricing, CTA différencié
- Disposition: Cartes alignées, plan mis en avant visuellement
- Psychologie: Valeur évidente, comparaison claire
- 3D: Éléments décoratifs autour des cartes pricing`,

    testimonial: `SECTION TESTIMONIAL - Preuve sociale
- Objectif: Construire la crédibilité via des témoignages réels
- Éléments: Avatar, citation, nom, entreprise/position
- Disposition: Carousel ou grille de témoignages
- Authenticité: Photos réelles, citations naturelles
- 3D: Cadres décoratifs pour les avatars`,

    contact: `SECTION CONTACT - Conversion finale
- Objectif: Faciliter le passage à l'action
- Éléments: Formulaire minimaliste, informations de contact, CTA fort
- UX: Formulaire simple, validation visuelle, message de succès
- 3D: Élément interactif autour du formulaire`
};

// Prompts par type de site
const SITE_TYPE_PROMPTS = {

//   site: `SITE Complet - Professionnalisme institutionnel comme le site d'Evenlab
// - Focus: Confiance, expertise, relations d'affaires
// - Sections: Hero , Services/Expertise, Case Studies, Team, Partners, Contact professionnel
// - Ton: Formel mais accessible, données chiffrées, preuves de réussite
// - 3D: Éléments corporate discrets (graphiques, structures)`,

    portfolio: `SITE PORTFOLIO - Présentation créative
- Focus: Mettre en valeur le travail et la personnalité
- Sections typiques: Hero percutant, Projects (grille visuelle), About personnel, Skills/Expertise, Testimonials, Contact
- Design: Visuel fort, navigation portfolio-centric, animations créatives
- 3D: Modèles représentant le domaine créatif`,

    ecommerce: `SITE ECOMMERCE - Conversion commerciale
- Focus: Vendre des produits efficacement
- Sections: Hero avec promotion, Featured Products, Categories, Best Sellers, Reviews, Newsletter
- UX: Navigation produit intuitive, fiches produits détaillées, tunnel de conversion optimisé
- 3D: Visualisation produits en 3D, interactions d'achat`,

    corporate: `SITE CORPORATE - Professionnalisme institutionnel
- Focus: Confiance, expertise, relations d'affaires
- Sections: Hero corporate, Services/Expertise, Case Studies, Team, Partners, Contact professionnel
- Ton: Formel mais accessible, données chiffrées, preuves de réussite
- 3D: Éléments corporate discrets (graphiques, structures)`,

    custom: `SITE CUSTOM - Structure personnalisée
- Focus: Répondre aux besoins spécifiques du client
- Sections: À définir selon la description utilisateur
- Design: Adapté aux contraintes et objectifs particuliers
- 3D: Éléments pertinents pour le contexte`
};

// Configuration des services AI
const AI_SERVICES = {
    groq: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKey: process.env.GROQ_API_KEY
    },
    deepseek: {
        url: 'https://api.deepseek.com/v1/chat/completions',
        apiKey: process.env.DEEPSEEK_API_KEY
    },
    anthropic: {
        url: 'https://api.anthropic.com/v1/messages',
        apiKey: process.env.ANTHROPIC_API_KEY
    }
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
            model = 'llama-3.1-8b-instant'
        } = req.body;

        if (!description) {
            return res.status(400).json({ error: "Description est obligatoire" });
        }

        // Récupérer l'utilisateur depuis le token
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return res.status(401).json({ error: "Token manquant" });

        let userId;
        try {
            userId = decodeToken(token);
        } catch {
            return res.status(401).json({ error: "Token invalide" });
        }

        // Vérifier quotas avant génération
        const isPaidRequest = req.body.usePaid || false;

        // 🔹 1️⃣ Vérification du quota avant génération
        const { user, error: quotaError } = await checkQuota(userId, isPaidRequest, model);
        if (quotaError) return res.status(403).json({ error: quotaError });
        

        // Construction du prompt selon le type
        const styleRules = STYLE_RULES[style] || STYLE_RULES['minimaliste'];
        const audienceHint = AUDIENCE_HINTS[audience] || '';

        let typePrompt = '';
        if (type === 'section' && typeSection) {
            typePrompt = SECTION_PROMPTS[typeSection] || `Section de type: ${typeSection}`;
        } else if (type && SITE_TYPE_PROMPTS[type]) {
            typePrompt = SITE_TYPE_PROMPTS[type];
        } else {
            typePrompt = `SITE COMPLET - Landing page immersive
- Sections typiques: Hero avec CTA (header avec navigation, titre, description, appel à l'action, visuel 3D), About, Features, Pricing, Testimonials, Contact, Footer
- Structure: Header (flex wrap justify-between avec padding lateral contenant logo + nav + 0-2 boutons CTA), sections avec minHeight 100vh
- 3D: Éléments stratégiques pour l'immersion, animations cohérentes`;
        }

        // Pour les sections custom, on utilise la description utilisateur
        if (type === 'section' && typeSection === 'custom') {
            typePrompt = `SECTION CUSTOM - Personnalisée selon demande utilisateur
Description utilisateur: ${description}
- Adapter la structure aux besoins spécifiques
- Respecter le style et l'audience demandés`;
        }

        const prompt = {
            instruction: `
Tu es un expert en développement front-end et en 3D, spécialisé sur le framework Digilia. 
Ta mission est de générer ${type === 'section' ? 'une section' : 'une landing page complète'} ${type && type !== 'section' ? `de type ${type}` : ''}.

${typePrompt}

- Concentre-toi sur un design fort et élégant, avec typographie moderne, navigation minimaliste et expérience immersive. 
- Utilise les ressources 3D intelligemment : modèles essentiels, animations pertinentes, reflets réalistes, lumière et caméra dynamique, sans duplication inutile pour préserver la performance. 
- Les animations doivent être cohérentes et ciblées : appliquer className et data-aos uniquement sur les éléments qui le méritent (texte lisible ou objets visuels, jamais sur divs parent inutiles). 
- Chaque section doit avoir une logique claire : début et fin visibles, hiérarchie cohérente, conversion facilitée, texte attractif et orienté conversion.
- Pour chaque conteneur qui contient des éléments dans son children, toujours préciser le display (block/flex/grid etc), pour flex ne pas oublier le gap. Pour les grandes sections minHeight 100vh.
- Utilise des images directes sur internet (unsplash etc) sinon utilise https://mir-s3-cdn-cf.behance.net/project_modules/1400/2411cd212698699.6739e4f591f43.png
- Applique une police à tout texte selon les préférences utilisateur
- Veille à la lisibilité de chaque texte
- ${styleRules} 
- ${audienceHint}

Respecte strictement le schéma Digilia fourni : id, name, elementType, type, className, style, content, attributes, events, asset, material, transform, animations, children, plateforme.
- Non obligation et si vide mieux ne pas mentionner: className, style, content, attributes, events, asset, material, transform, animations, children, plateforme.
- Réfléchir avant utilisation : className, style, attributes, NB: Ne pas appliquer className sur grand élément (ex: >500px) comme DIV ou texte.
Toutes les valeurs doivent correspondre au type attendu. Ne génère pas de texte explicatif.
            `,
            digiliaSchema,
            userData: {
                description,
                type,
                typeSection,
                style,
                fonts,
                audience, 
                colors,
                language
            },
            instructionFinale: `
Génère la structure JSON complète Digilia correspondant aux informations ci-dessus. Rien d'autre que le JSON: {id ...}. Répond uniquement avec du JSON valide conforme au schéma Digilia. Ne mets aucun texte explicatif.
            `       
        };

        let chosenModel = model in MODEL_FALLBACKS ? model : 'qwen/qwen3-32b';

        let response;
        let updatedUser;
        try {
            response = await queryAI(prompt, chosenModel);
            // 🔹 3️⃣ Mise à jour du quota après succès
            updatedUser = await applyQuota(userId, isPaidRequest, model);
        } catch (err) {
            console.log("*************************************************erreur ModelOOOOOOOOOOOOOOOO:", err);
            const fallbackModel = MODEL_FALLBACKS[chosenModel] || 'llama-3.1-8b-instant';
            response = await queryAI(prompt, fallbackModel);
            chosenModel = fallbackModel;
            // 🔹 3️⃣ Mise à jour du quota après succès
            updatedUser = await applyQuota(userId, isPaidRequest, fallbackModel);
        }

        const dailyLimit = updatedUser.subscription.type === 'premium' ? 10
                 : (updatedUser.subscription.type === 'basic' ? 5 : 5);
        const paidLimit = updatedUser.subscription.type === 'premium' ? 50 
                 : (updatedUser.subscription.type === 'basic' ? 20 : 0);

        res.json({
            modelUsed: chosenModel,
            data: response,
            quota: {
                dailyUsed: updatedUser.dailyGenerations,
                dailyRemaining: dailyLimit - updatedUser.dailyGenerations,
                paidUsed: updatedUser.subscription.type !== 'free' ? 
                  (updatedUser.paidGenerations > paidLimit ? 0 :
                  (paidLimit - updatedUser.paidGenerations)) : 0,
                paidRemaining: updatedUser.paidGenerations
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erreur serveur" });
    }
}

/**
 * Fonction pour interroger l'API IA
 */
async function queryAI(promptData, model) {
    // Déterminer le service à utiliser basé sur le modèle
    let service;
    if (model.includes('claude')) {
        service = AI_SERVICES.anthropic;
    } else if (model.includes('WWdeepseek')) {
        service = AI_SERVICES.deepseek;
    } else if (model.includes('gpt')) {
        service = AI_SERVICES.groq;
    } else {
        service = AI_SERVICES.groq; // Par défaut Groq pour les modèles Llama
    }

    const body = {
        model: model,
        messages: [
            // { role: 'user', content: JSON.stringify(promptData) },
            { role: "system", content: promptData.instruction }, // Instructions générales / contexte
        
        { role: "user", content: JSON.stringify({ digiliaSchema: promptData.digiliaSchema, userData: promptData.userData, finaleJson: promptData.instructionFinale}) }
            // Les données spécifiques pour la génération
        ],
        max_tokens: MAX_TOKENS_MAP[model] || 131072,
        temperature: 0.7
    };

    const response = await axios.post(service.url, body, {
        headers: {
            'Authorization': `Bearer ${service.apiKey}`,
            'Content-Type': 'application/json'
        }
    });
    console.log(response);
    const rawContent = response.data?.choices?.[0]?.message?.content;

    if (!rawContent) {
        return { error: "Aucune réponse de l'IA" };
    }

    // Nettoyer le contenu
    const cleanedContent = rawContent.replace(/^```json\s*/, '').replace(/```$/, '');

    let jsonData;
    try {
        if (cleanedContent.trim().startsWith("[")) {
            const parsedArray = JSON.parse(cleanedContent);
            jsonData = Array.isArray(parsedArray) ? parsedArray[0] : parsedArray;
        } else {
            jsonData = JSON.parse(cleanedContent);
        }
    } catch (e) {
        return { error: "Réponse IA invalide (non JSON)" };
    }
    
    return jsonData;
}

module.exports = { handleAICreation };