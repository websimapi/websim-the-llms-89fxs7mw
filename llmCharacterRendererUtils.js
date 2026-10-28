// Shared utilities for consistent character rendering across the application
import * as THREE from 'three';

// Create standardized materials based on LLM properties
export function createStandardMaterials(color, style) {
    let emissiveIntensity = 0;
    let metalness = 0.2;
    let roughness = 0.7;

    // Apply style variations
    switch(style) {
        case 'modern':
            metalness = 0.6;
            roughness = 0.2;
            break;
        case 'classic':
            metalness = 0.1;
            roughness = 0.9;
            break;
        case 'retro':
            metalness = 0.3;
            roughness = 0.8;
            break;
        case 'futuristic':
            metalness = 0.8;
            roughness = 0.1;
            emissiveIntensity = 0.5;
            break;
        // Add default case or handle unknown styles
        default:
             // Use default values or log a warning
             console.warn(`Unknown style provided: ${style}. Using default material properties.`);
             break;
    }

    const threeColor = new THREE.Color(color);

    // Create standardized materials
    const headMaterial = new THREE.MeshStandardMaterial({
        color: threeColor,
        emissive: threeColor.clone().multiplyScalar(0.3),
        emissiveIntensity: emissiveIntensity,
        metalness: metalness + 0.2,
        roughness: roughness - 0.1
    });

    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: threeColor.clone().multiplyScalar(0.8),
        emissive: threeColor.clone().multiplyScalar(0.2),
        emissiveIntensity: emissiveIntensity,
        metalness: metalness,
        roughness: roughness
    });

    const limbsMaterial = new THREE.MeshStandardMaterial({
        color: threeColor.clone().multiplyScalar(0.6),
        emissive: threeColor.clone().multiplyScalar(0.1),
        emissiveIntensity: emissiveIntensity,
        metalness: metalness + 0.3,
        roughness: roughness + 0.1
    });

    // Simplified eye material - using MeshBasicMaterial might look flat, consider Standard
    const eyeMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffff, // Cyan color
        emissive: 0x55ffff, // Make eyes glow
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.1
    });

    const antennaTipMaterial = new THREE.MeshStandardMaterial({
        color: 0xff0000, // Red tip
        emissive: 0xff5555, // Glowing red
        emissiveIntensity: 1,
        roughness: 0.5,
        metalness: 0.3
    });

    const chestLightMaterial = new THREE.MeshStandardMaterial({
        color: threeColor.clone().multiplyScalar(1.5),
        emissive: threeColor.clone().multiplyScalar(2.0), // Brighter glow
        emissiveIntensity: 1,
        roughness: 0.4,
        metalness: 0.2
    });

    return {
        headMaterial,
        bodyMaterial,
        limbsMaterial,
        eyeMaterial,
        antennaTipMaterial,
        chestLightMaterial
    };
}

// New functions for model serialization and storage
export function serializeModelData(model) {
    const modelData = {
        parts: []
    };

    model.traverse(child => {
        if (child.isMesh && child.material) {
            // Ensure mesh has a name for reliable lookup during loading
            if (!child.name) {
                console.warn("Mesh missing name during serialization, assigning temporary:", child);
                // Find a unique name - potentially based on hierarchy?
                let pathName = child.uuid; // Fallback to UUID if hierarchy is complex
                try {
                     pathName = getObjectPath(child, model);
                 } catch (e) { console.error("Error getting object path:", e)}
                 child.name = pathName;
            }

            modelData.parts.push({
                name: child.name, // Use the mesh's name
                position: child.position.toArray(),
                rotation: [child.rotation.x, child.rotation.y, child.rotation.z],
                scale: child.scale.toArray(),
                materialProps: serializeMaterial(child.material),
                transforms: child.userData.transforms || { // Ensure transforms are saved
                    position: { x: child.position.x, y: child.position.y, z: child.position.z },
                    rotation: { x: child.rotation.x, y: child.rotation.y, z: child.rotation.z }
                }
            });
        }
    });

    return modelData;
}

// Helper to get a unique path-based name for an object within a model
function getObjectPath(object, root) {
    const path = [];
    let current = object;
    while (current && current !== root) {
        path.unshift(current.name || current.type); // Use name or type
        current = current.parent;
    }
     // Filter out empty names and join
     const filteredPath = path.filter(Boolean);
     if (filteredPath.length === 0 && object.name) return object.name; // If root object itself has a name
     if (filteredPath.length === 0) return object.uuid; // Ultimate fallback
    return filteredPath.join('/');
}


export function serializeMaterial(material) {
    const materialData = {
        type: material.type
    };

    // Store color properties if they exist
    if (material.color) materialData.color = '#' + material.color.getHexString();
    if (material.emissive) materialData.emissive = '#' + material.emissive.getHexString();
    if (material.specular) materialData.specular = '#' + material.specular.getHexString();

    // Store numeric properties
    const numericProps = ['metalness', 'roughness', 'opacity', 'transparent', 'emissiveIntensity'];
    numericProps.forEach(prop => {
        if (material[prop] !== undefined) materialData[prop] = material[prop];
    });

    return materialData;
}