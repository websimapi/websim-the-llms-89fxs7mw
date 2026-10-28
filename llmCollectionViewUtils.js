import * as THREE from 'three';

// Handles model creation for the collection view
export function createCollectionModels(llms, llmDataManager, createCustomCharacter) {
    const models = [];
    const positions = [];
    const scene = new THREE.Scene();
    
    // Setup floor
    const floorGeometry = new THREE.PlaneGeometry(50, 50);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    
    // Create models for each LLM
    llms.forEach((llm, index) => {
        // Position models in a semi-circle
        const numPositions = Math.max(10, llms.length);
        const angle = (Math.PI) * (index / (numPositions - 1)) - Math.PI/2;
        const radius = 5;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        let llmModel;
        
        if (llm.customCharacterCode) {
            // Create custom character from stored code
            try {
                llmModel = createCustomCharacter(THREE, llm.customCharacterCode);
            } catch (error) {
                console.error("Error creating custom character:", error);
                // Create fallback model
                llmModel = createFallbackModel(llm);
            }
        } else {
            // Create standard model based on stored properties
            llmModel = createStandardModel(llm);
        }
        
        // Position the model
        llmModel.position.set(x, 0, z);
        llmModel.rotation.y = -angle;
        llmModel.userData = { id: llm.id };
        
        scene.add(llmModel);
        models.push(llmModel);
        positions.push({ x, y: 0, z });
    });
    
    return { models, positions, scene };
}

// Create a standard model for an LLM
function createStandardModel(llm) {
    // Create a simple robot model based on the LLM properties
    const group = new THREE.Group();
    
    const color = new THREE.Color(llm.color || 0x3cb371);
    
    // Create head
    const headMaterial = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color.clone().multiplyScalar(0.3),
        metalness: 0.7,
        roughness: 0.3
    });
    
    const head = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        headMaterial
    );
    head.position.y = 1.8;
    group.add(head);
    
    // Create body
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: color.clone().multiplyScalar(0.8),
        metalness: 0.5,
        roughness: 0.5
    });
    
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.8, 0.3),
        bodyMaterial
    );
    body.position.y = 1.2;
    group.add(body);
    
    // Create simple limbs
    const limbsMaterial = new THREE.MeshStandardMaterial({
        color: 0x444444,
        metalness: 0.8,
        roughness: 0.2
    });
    
    // Add simple arms and legs
    const arms = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.2, 0.2),
        limbsMaterial
    );
    arms.position.y = 1.3;
    group.add(arms);
    
    const legs = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.15, 1),
        limbsMaterial
    );
    legs.position.y = 0.5;
    group.add(legs);
    
    return group;
}

// Create a fallback model if the custom model fails
function createFallbackModel(llm) {
    // Very simple fallback model
    const group = new THREE.Group();
    
    const color = new THREE.Color(llm.color || 0x3cb371);
    
    // Create body
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 1.7),
        new THREE.MeshStandardMaterial({ color })
    );
    body.position.y = 0.85;
    group.add(body);
    
    // Add a nameplate
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(llm.name, canvas.width / 2, canvas.height / 2 + 8);
    
    const texture = new THREE.CanvasTexture(canvas);
    const nameMaterial = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true
    });
    
    const nameplate = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.25),
        nameMaterial
    );
    nameplate.position.set(0, 2, 0);
    nameplate.rotation.y = Math.PI;
    group.add(nameplate);
    
    return group;
}