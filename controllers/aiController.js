// controllers/aiController.js
const axios = require('axios');
const User = require('../models/User');
const decodeToken = require('../utils/verifyToken');
const { checkQuota, applyQuota } = require('../utils/quotaManager');
const moment = require('moment');
// import fs from 'fs';
const fs = require('fs');const util = require("util");


// Liste des modèles disponibles et leur fallback
const MODEL_FALLBACKS = {
    'claude-opus-4': 'claude-opus-4',
    'claude-sonnet-4': 'claude-sonnet-4',
    'openai/gpt-oss-120B': 'openai/gpt-oss-20B',
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

const digiliaSchema = 
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
        "asset": "string (obligatoire seulement pour 3DElement, doit être un des fichiers suivants: /models/connecteurs.glb (descripton: forme cylyndre croissé, couleur: noir, changeColor: true), /models/diamond.glb (descripton: forme diament, couleur: noir, changeColor: true), /models/abstract-doughnut.glb (descripton: forme multi-cable circulaire croisse avec detail, couleur: gris-noir, changeColor: true), /models/abstract-ball.glb (descripton: forme sphérique croissée, couleur: gris, changeColor: false), /models/car-feature.glb (changeColor: false), /models/Helico.glb(changeColor: false), /models/paradox_abstract_art_of_python.glb (descripton: artistique, couleur: noir))",
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
;

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
- Objectif: Capturer l'attention immédiate, valeur proposition claire.
- Pattern: Choisis un pattern aléatoire unique parmi :
  • hero-overlay : visuel fullscreen avec textes/CTA superposés en overlay centré, tout les elements avec zIndex, responsive avec repositionnement fluide.
  • hero-split : 2 colonnes (texte + CTA d’un côté, visuel 3D de l’autre), responsive en stack sur mobile.    
  • hero-floating : éléments (texte, visuel, CTA) disposés librement en layering avec animations de flottement, responsive en réorganisation verticale.  
  • hero-minimal : mise en avant centrée d’un seul élément fort (texte ou visuel), avec beaucoup d’espace négatif, responsive avec scaling.  
⚠️ Évite le modèle générique “titre + desc + bouton + img statique”.
- Header: Flexible, en haut ou en bas. Contient logo/siteName, navigation, et 0-2 boutons CTA. Ne pas utiliser fixed; éviter de coller aux bords (ajouter marges/padding adaptés).
- Hero: Contient un titre percutant (h1), un sous-titre accrocheur, 1-2 CTA principaux, et un visuel impactant (3D ou image). 
  → Si visuel 3D, placer en absolute top&left à 50%, centré tranform, sans overflow hidden.
- Disposition: Layout moderne, texte centre ou à gauche/droite, visuel en fond selon le pattern choisi ou à droite/gauche.
- Typographie: Titre en police forte, sous-titre lisible.
- Interactions: AOS animation sur tout, hover/scroll subtils sur CTA.
- 3D: Doit être impactant et narratif (lié au branding), pas décoratif. Prévoir animation douce (rotation, flottement, entrée).
- Inclure un micro-interaction “scroll-indicator” centré en bas.
  Exemple: texte “Scroll” + flèche animée en y ou pulse (|).
  → Doit avoir un id unique, style premium (gradient animé, glow subtil, glassmorphism, 3D flottant).
  → Ne jamais répéter identique deux fois: varier nom, style ou animation.
  → Discret mais visible (ne gêne pas la Hero principale).`
,

    about: `SECTION ABOUT - Présentation authentique
- Objectif: Établir confiance et connexion émotionnelle
- Éléments: Titre évocateur, texte narratif, valeurs/mission, visuel humain/authentique. Utilise bg-linear avec 120deg(si couleur user sombre sinon utulise des nuances sombres)
- Disposition: [(miniTexte:"About" en gras, Titre en Texte + description et image côte à côté ou alternés]
- Ton: Chaleureux, personnel, authentique`,

    features: `SECTION FEATURES - Valeurs fonctionnelles
- Objectif: Démontrer l'utilité concrète
- Éléments: (si e-com ou necessaire: Grille de 3-6 features avec icône/titre/description
- Disposition: Grille responsive, cartes avec ombres/micro-interactions
- Interactions: Hover effects sur les cartes, animations au scroll
 -Sinon c'est pour un mono produits specifiques juste un 3D: Icônes 3D interactives time et srolle, feature entouter des textes qui explique le produit.`,

    pricing: `SECTION PRICING - Offres commerciales
- Objectif: Présenter clairement les options et encourager l'action
- Éléments: 3-4 plans avec avantages, pricing, CTA différencié
- Disposition: Cartes alignées, plan mis en avant visuellement
- Psychologie: Valeur évidente, comparaison claire
- Animation Hover: Éléments ou assets décoratifs autour des cartes pricing`,

    testimonial: `SECTION TESTIMONIAL - Preuve sociale
- Objectif: Construire la crédibilité via des témoignages réels et des vrais noms
- Éléments: Avatar, citation, min-2lignes, nom, entreprise/position
- Disposition: Carousel(hidden snap) ou grille de témoignages
- Authenticité: Photos réelles, citations naturelles`,

    contact: `SECTION CONTACT - Conversion finale
- Objectif: Faciliter le passage à l'action
- Éléments: Formulaire minimaliste, informations de contact, FAQ, CTA fort, contact, system pay, medias sociaux, politic copirigth
- UX: Formulaire simple avec image, validation visuelle, message de succès
- Asset: Petits Éléments interactifs float y autour du formulaire`
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
- Sections: Hero avec promotion, Featured Products, Categories, Best Sellers, Reviews, Newsletter, FAQ, Contact, Footer avec ingo-contact, system pay, medias sociaux, politic copirigth.
- UX: Navigation produit intuitive, fiches produits détaillées, tunnel de conversion optimisé
- 3D: Visualisation produits en 3D, interactions d'achat`,

    corporate: `SITE CORPORATE - Professionnalisme institutionnel
- Focus: Confiance, expertise, relations d'affaires
- Sections: Hero corporate avec chiffres, About Historique, Services/Expertise, Case Studies, Team, Partners, Newsletter, Contact professionnel
- Ton: Formel mais accessible, données chiffrées, preuves de réussite
- 3D: Éléments corporate discrets (graphiques, structures)`,

    custom: `SITE CUSTOM - Structure personnalisée
- Focus: Répondre aux besoins spécifiques du client
- Sections: À définir selon la description utilisateur
- Design: Adapté aux contraintes et objectifs particuliers
- 3D: Éléments pertinents pour le contexte`
};

// Configuration des services AI avec clés multiples pour Groq
const AI_SERVICES = {
    groq: {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        apiKeys: [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2] // Deux clés pour Groq
    },
    deepseek: {
        url: 'https://api.deepseek.com/v1/chat/completions',
        apiKeys: [process.env.DEEPSEEK_API_KEY]
    },
    anthropic: {
        url: 'https://api.anthropic.com/v1/messages',
        apiKeys: [process.env.ANTHROPIC_API_KEY]
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
            typePrompt = `SITE COMPLET - Landing page immersive premium
- Sections typiques: Hero avec CTA (header avec logo utilisateur(evite fixed), navigation, titre, description, appel à l'action, visuel 3D immersif), About, Features, Pricing, Testimonials, Contact, Footer
- Structure: Header (flex wrap justify-between avec padding latéral, contenant logo utilisateur + nav + 0-2 boutons CTA). Chaque section doit avoir minHeight 100vh, hiérarchie claire (titre, sous-titre, contenu, CTA).
- Règles de différenciation:
  1. Pour chaque section, choisis un pattern unique et aléatoire (split, overlay, floating, minimal).
  2. Ajoute au moins 1 élément visuel disruptif non-standard (split diagonal, texte translucide overlay, 3D flottant interactif, gradient futuriste animé, cartes en orbite).
  3. Applique une influence-style aléatoire: Marcelo Design, Brutalisme bold, Behance 3D futuriste, Dribbble premium, Apple-like épuré.
  4. Toujours utiliser et enrichir les données fournies par l’utilisateur (logo, textes, CTA, stats, images).
  5. Chaque design doit être digne d’un post Instagram ou Behance premium, éviter absolument tout rendu banal type WordPress/Elementor.
- 3D: Intègre au moins un élément 3D immersif dans la Hero ou Features, avec une animation cohérente (rotation douce, flottement, particules, orbite).
- Résultat: Génère un JSON complet avec id, name, elementType, type, style (layout, background, couleurs, hover, scroll), events, content et assets.`;
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
- Utilise les ressources 3D intelligemment : modèles essentiels, animations pertinentes, reflets réalistes, lumière et caméra dynamique, sans duplication inutile, pas de 3d partout(Soit hero ou une fois dans feature, pas dans card) car le digilia est riche en fonctionalité et animation, alors equilibre(aos, classname etc) pour préserver la performance.
- Les animations doivent être cohérentes et ciblées : appliquer className et data-aos uniquement sur les éléments qui le méritent (texte lisible ou objets visuels, jamais sur divs parent inutiles).- Applique une police à tout texte selon les préférences utilisateur
- Veille à la lisibilité de chaque texte, disposer en start, center ou end selon l'emplacement, text explicite, pas de titre sans texte dans une section.
- Chaque section doit avoir une logique claire : début et fin visibles, hiérarchie cohérente, conversion facilitée, texte attractif et orienté conversion.
- Pour chaque conteneur qui contient des éléments dans son children, toujours préciser le display (block/flex/grid etc), pour flex ne pas oublier le gap et flexWrap. Pour les grandes sections minHeight 100vh. Priorites sur les couleurs vives et non fades
- Utilise des images directes sur internet (unsplash etc) sinon utilise https://mir-s3-cdn-cf.behance.net/project_modules/1400/2411cd212698699.6739e4f591f43.png
- ${styleRules} 
- ${audienceHint}

Règles de différenciation pour chaque génération :

1. Pour chaque section, choisis **un pattern aléatoire unique** parmi les options disponibles (ex: -split, overlay, floating, minimal). Ne jamais répéter deux fois le même pattern pour le même utilisateur consécutif.

2. Ajoute **au moins 1 élément visuel disruptif non-standard** dans la section, exemple : split diagonal, texte translucide en overlay, 3D flottant interactif, gradient futuriste animé, cards en orbite.

3. Applique une **influence-style aléatoire** choisie dans cette liste : Marcelo Design, Brutalisme (bold / expérimental), Behance 3D futuriste, Dribbble premium minimal-luxueux, Apple-like épuré.

4. Chaque design doit être digne d’un post Instagram ou Behance premium, éviter absolument tout rendu banal type WordPress/Elementor.

5. Randomiser tous les choix ci-dessus pour chaque génération, afin que même avec le même input utilisateur, le résultat soit toujours différent et surprenant. 

Respecte strictement le schéma Digilia fourni : id, name, elementType, type, className, style, content, attributes, events, asset, material, transform, animations, children, plateforme.
- Non obligation et si vide mieux ne pas mentionner: className, style, content, attributes, events, asset, material, transform, animations, children, plateforme.
- Obligation pour tout element: id, name, elementType, type
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
Génère la **structure JSON complète Digilia** correspondant aux informations ci-dessus. **Rien d’autre que le JSON: {...}**. Répond uniquement avec du JSON valide conforme au schéma Digilia. Ne mets aucun texte explicatif.
            `      
        };

        let chosenModel = model in MODEL_FALLBACKS ? model : 'qwen/qwen3-32b';

        let response;
        let updatedUser;
        let finalModel = chosenModel;
        
        try {
            response = await queryAI(prompt, chosenModel);
            // 🔹 3️⃣ Mise à jour du quota après succès
            updatedUser = await applyQuota(userId, isPaidRequest, chosenModel);
        } catch (err) {
            console.log("*************************************************Erreur avec le modèle principal:", err.message);
            
            // Tentative avec fallback model
            const fallbackModel = MODEL_FALLBACKS[chosenModel] || 'llama-3.1-8b-instant';
            
            if (fallbackModel !== chosenModel) {
                try {
                    console.log("Tentative avec modèle fallback:", fallbackModel);
                    response = await queryAI(prompt, fallbackModel);
                    finalModel = fallbackModel;
                    // 🔹 Mise à jour du quota après succès avec fallback
                    updatedUser = await applyQuota(userId, isPaidRequest, fallbackModel);
                } catch (fallbackErr) {
                    console.log("Échec également avec le modèle fallback:", fallbackErr.message);
                    return res.status(500).json({ 
                        error: "Échec de génération. Veuillez essayer avec un autre modèle ou réessayer plus tard." 
                    });
                }
            } else {
                return res.status(500).json({ 
                    error: "Échec de génération. Veuillez essayer avec un autre modèle ou réessayer plus tard." 
                });
            }
        }

        const dailyLimit = updatedUser.subscription.type === 'premium' ? 10
                 : (updatedUser.subscription.type === 'basic' ? 5 : 5);
        const paidLimit = updatedUser.subscription.type === 'premium' ? 50 
                 : (updatedUser.subscription.type === 'basic' ? 20 : 0);

        res.json({
            modelUsed: finalModel,
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
 * Fonction pour interroger l'API IA avec gestion des clés multiples pour Groq
 */
async function queryAI(promptData, model) {
    // Déterminer le service à utiliser basé sur le modèle
    let service;
    let serviceName;
    
    if (model.includes('claude')) {
        serviceName = 'anthropic';
        service = AI_SERVICES.anthropic;
    } else if (model.includes('deepseek')) {
        serviceName = 'deepseek';
        service = AI_SERVICES.deepseek;
    } else {
        serviceName = 'groq';
        service = AI_SERVICES.groq;
    }

    let lastError;
    
    // Pour Groq, essayer toutes les clés disponibles
    for (let i = 0; i < service.apiKeys.length; i++) {
        const apiKey = service.apiKeys[i];
        
        if (!apiKey) {
            console.log(`Clé API ${i + 1} manquante pour ${serviceName}`);
            continue;
        }

        try {
            const body = buildRequestBody(promptData, model, serviceName);
            
            // Convertir en JSON joli pour lire facilement
            const jsonString = JSON.stringify(body, null, 2);
            fs.writeFileSync('requestBody.txt', jsonString);
            console.log('Le corps de la requête a été enregistré dans requestBody.txt');

                const response = await axios.post(service.url, body, {
                    headers: getRequestHeaders(serviceName, apiKey)
                });
            // console.log(response);
            // util.inspect permet de sérialiser des objets complexes sans erreur
            const fullResponse = util.inspect(response, { depth: null, colors: false });
            fs.writeFileSync("response.txt", fullResponse, "utf-8");
            console.log("Réponse complète sauvegardée dans response.txt ✅");

            
            console.log(`✅ Succès avec clé API ${i + 1} pour ${serviceName}`);
            
            // Extraire le contenu selon le service
            const rawContent = extractContent(response, serviceName);
            
            if (!rawContent) {
                throw new Error("Aucune réponse de l'IA");
            }


            // ***************************************
            console.log("=== DEBUG NETTOYAGE ===");
            console.log("Longueur rawContent:", rawContent.length);
            console.log("100 premiers caractères RAW:", JSON.stringify(rawContent.substring(0, 100)));
            console.log("100 derniers caractères RAW:", JSON.stringify(rawContent.substring(rawContent.length - 100)));

            // Testez différentes méthodes de nettoyage
            const cleaned1 = rawContent.replace(/^```json\s*/, '').replace(/```$/, '');
            const cleaned2 = rawContent.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();

            console.log("Méthode 1 longueur:", cleaned1.length);
            console.log("Méthode 2 longueur:", cleaned2.length);
            // ****************************************



            // Nettoyer le contenu
            const cleanedContent = rawContent.replace(/^```json\s*/, '').replace(/```$/, '');

            let jsonData;
            try {
                if (cleanedContent.trim().startsWith("[")) {
                    console.log("Avait un []");
                    
                    const parsedArray = JSON.parse(cleanedContent);
                    // jsonData = Array.isArray(parsedArray) ? parsedArray[0] : parsedArray;

                    // Transformer le tableau en objet avec les IDs comme clés
                    const result = {};
                    parsedArray.forEach(item => {
                        if (item.id) {
                            result[item.id] = item;
                        }
                    });
                    
                    jsonData = result; // Maintenant c'est un objet {}
                } else {
                    jsonData = JSON.parse(cleanedContent);
                }
            } catch (e) {
                throw new Error("Réponse IA invalide (non JSON)");
            }
            
            return jsonData;
            
        } catch (error) {
            lastError = error;
            console.log(`❌ Échec avec clé API ${i + 1} pour ${serviceName}:`, error.message);
            
            // Si c'est la dernière clé pour Groq, on propose de changer de modèle
            if (serviceName === 'groq' && i === service.apiKeys.length - 1) {
                throw new Error("Toutes les clés Groq ont échoué. Veuillez essayer avec un autre modèle.");
            }
            
            // Pour les autres services, on continue avec la clé suivante si disponible
            if (serviceName !== 'groq' && i < service.apiKeys.length - 1) {
                console.log("Tentative avec clé suivante...");
                continue;
            }
        }
    }
    
    // Si on arrive ici, toutes les tentatives ont échoué
    throw lastError || new Error("Échec de la requête AI");
}

/**
 * Construit le corps de la requête selon le service
 */
function buildRequestBody(promptData, model, serviceName) {
    if (serviceName === 'anthropic') {
        return {
            model: model,
            messages: [
                {
                    role: "user",
                    content: `${promptData.instruction}\n\n${JSON.stringify({ digiliaSchema: promptData.digiliaSchema, userData: promptData.userData, finaleJson: promptData.instructionFinale })}`
                }
            ],
            max_tokens: MAX_TOKENS_MAP[model] || 131072,
            temperature: 0.7
        };
    } else {
        // Format pour Groq et Deepseek
        return {
            model: model,
            messages: [
                { role: "system", content: promptData.instruction },
                { role: "user", content: JSON.stringify({ digiliaSchema: promptData.digiliaSchema, userData: promptData.userData, finaleJson: promptData.instructionFinale }) }
            ],
            // max_tokens: MAX_TOKENS_MAP[model] || 131072,
            temperature: 0.7
        };
    }
}

/**
 * Retourne les headers selon le service
 */
function getRequestHeaders(serviceName, apiKey) {
    const headers = {
        'Content-Type': 'application/json'
    };
    
    if (serviceName === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
    } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    return headers;
}

/**
 * Extrait le contenu de la réponse selon le service
 */
function extractContent(response, serviceName) {
    if (serviceName === 'anthropic') {
        return response.data?.content?.[0]?.text;
    } else {
        return response.data?.choices?.[0]?.message?.content;
    }
}

module.exports = { handleAICreation };