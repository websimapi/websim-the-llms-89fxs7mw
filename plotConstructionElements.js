import * as THREE from 'three';

// Create construction tape outline around a plot with wooden poles
export function createConstructionTape(width, depth, position) {
    const group = new THREE.Group();
    group.name = "construction_site";
    
    // Create tape material - yellow with black stripes
    const tapeCanvas = document.createElement('canvas');
    tapeCanvas.width = 256;
    tapeCanvas.height = 64;
    const ctx = tapeCanvas.getContext('2d');
    
    // Fill with yellow background
    ctx.fillStyle = '#FFDD00';
    ctx.fillRect(0, 0, tapeCanvas.width, tapeCanvas.height);
    
    // Add black diagonal stripes
    ctx.fillStyle = '#000000';
    const stripeWidth = 20;
    const stripeSpacing = 40;
    for (let i = -tapeCanvas.width; i < tapeCanvas.width * 2; i += stripeSpacing) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + stripeWidth, 0);
        ctx.lineTo(i + stripeWidth, tapeCanvas.height);
        ctx.lineTo(i, tapeCanvas.height);
        ctx.closePath();
        ctx.fill();
    }
    
    const tapeTexture = new THREE.CanvasTexture(tapeCanvas);
    tapeTexture.wrapS = THREE.RepeatWrapping;
    tapeTexture.wrapT = THREE.RepeatWrapping;
    tapeTexture.repeat.set(10, 1);
    
    const tapeMaterial = new THREE.MeshBasicMaterial({
        map: tapeTexture,
        side: THREE.DoubleSide,
        transparent: true
    });
    
    // Create wooden poles around the perimeter
    const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8);
    const poleMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513, // Brown wood color
        roughness: 0.9,
        metalness: 0.1,
        map: createWoodTexture()
    });
    
    // Higher tape elevation - 0.8m instead of 0.05m
    const tapeHeight = 0.15;
    const tapeElevation = 0.8;
    
    // Calculate pole spacing based on perimeter length
    const perimeter = 2 * (width + depth);
    const poleSpacing = Math.min(3, perimeter / 8); // Not more than 8 poles per side, minimum 3m spacing
    
    // Place poles and tape segments around the perimeter
    // Front side
    createSideWithPoles(group, width, depth/2, 0, Math.PI, width, tapeHeight, tapeElevation, poleGeometry, poleMaterial, tapeMaterial, poleSpacing);
    
    // Back side
    createSideWithPoles(group, width, -depth/2, 0, 0, width, tapeHeight, tapeElevation, poleGeometry, poleMaterial, tapeMaterial, poleSpacing);
    
    // Left side
    createSideWithPoles(group, depth, 0, -width/2, Math.PI/2, depth, tapeHeight, tapeElevation, poleGeometry, poleMaterial, tapeMaterial, poleSpacing);
    
    // Right side
    createSideWithPoles(group, depth, 0, width/2, -Math.PI/2, depth, tapeHeight, tapeElevation, poleGeometry, poleMaterial, tapeMaterial, poleSpacing);
    
    // Position the entire group
    group.position.set(position.x, position.y, position.z);
    
    return group;
}

// Helper function to create a side with poles and tape
function createSideWithPoles(group, sideLength, zPos, xPos, rotation, width, tapeHeight, tapeElevation, poleGeometry, poleMaterial, tapeMaterial, poleSpacing) {
    // Create tape segment
    const tape = new THREE.Mesh(
        new THREE.PlaneGeometry(width, tapeHeight),
        tapeMaterial
    );
    tape.position.set(xPos, tapeElevation, zPos);
    tape.rotation.y = rotation;
    tape.name = "tape_segment";
    group.add(tape);
    
    // Add poles
    const numPoles = Math.max(2, Math.floor(sideLength / poleSpacing) + 1);
    const actualSpacing = sideLength / (numPoles - 1);
    
    for (let i = 0; i < numPoles; i++) {
        // Calculate pole position along the side
        const offset = (i * actualSpacing) - (sideLength / 2);
        let poleX = xPos;
        let poleZ = zPos;
        
        // Adjust X or Z based on side orientation
        if (Math.abs(rotation) === Math.PI/2) {
            poleZ = offset;
        } else {
            poleX = offset;
        }
        
        // Create the pole
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(poleX, 0.6, poleZ); // Half height of pole
        pole.castShadow = true;
        pole.name = "pole_support";
        group.add(pole);
    }
}

// Create detailed construction cones for a plot
export function createConstructionCones(width, depth, position) {
    const group = new THREE.Group();
    
    // Create cone geometry with more detail
    const coneBaseRadius = 0.3;
    const coneHeight = 0.7;
    const coneGeometry = new THREE.ConeGeometry(coneBaseRadius, coneHeight, 32); // More segments for smoother look
    
    // Create more realistic orange material for cones with slight reflection
    const orangeMaterial = new THREE.MeshStandardMaterial({
        color: 0xFF5500, // Brighter orange color
        roughness: 0.7,
        metalness: 0.2,
        emissive: 0x331100, // Slight glow
        emissiveIntensity: 0.2
    });
    
    // Create reflective stripe material
    const stripeMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFFFF,
        roughness: 0.3,
        metalness: 0.8,
        emissive: 0xAAAAAA,
        emissiveIntensity: 0.3
    });
    
    // Define cone positions (only at corners)
    const conePositions = [
        {x: -width/2, z: -depth/2}, // Bottom left
        {x: width/2, z: -depth/2},  // Bottom right
        {x: width/2, z: depth/2},   // Top right
        {x: -width/2, z: depth/2}   // Top left
    ];
    
    // Create and position detailed cones
    conePositions.forEach(pos => {
        // Create cone body
        const cone = new THREE.Mesh(coneGeometry, orangeMaterial);
        cone.position.set(pos.x, coneHeight/2, pos.z);
        cone.castShadow = true;
        cone.name = "cone_marker";
        group.add(cone);
        
        // Add reflective stripes (2 stripes per cone)
        for (let i = 1; i <= 2; i++) {
            const stripeHeight = coneHeight * (0.2 + (i * 0.25)); // Position stripes at 45% and 70% height
            const stripeRadius = coneBaseRadius * (1 - (stripeHeight / coneHeight));
            
            const stripeGeometry = new THREE.TorusGeometry(stripeRadius, 0.025, 16, 32);
            const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
            stripe.position.y = stripeHeight;
            stripe.rotation.x = Math.PI/2;
            cone.add(stripe);
        }
        
        // Add a base to the cone
        const baseGeometry = new THREE.CylinderGeometry(coneBaseRadius * 1.05, coneBaseRadius * 1.05, 0.05, 32);
        const baseMaterial = new THREE.MeshStandardMaterial({
            color: 0x000000, // Black base
            roughness: 0.9,
            metalness: 0.1
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.set(pos.x, 0.025, pos.z); // Just above ground
        base.castShadow = true;
        base.receiveShadow = true;
        base.name = "cone_base";
        group.add(base);
    });
    
    // Position the entire group
    group.position.set(position.x, position.y, position.z);
    
    return group;
}

// Helper function to create a wood texture
function createWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Base wood color
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Wood grain pattern
    ctx.strokeStyle = '#6B2504';
    ctx.lineWidth = 2;
    
    // Create grain lines
    for (let i = 0; i < 40; i++) {
        const y = i * 15;
        ctx.beginPath();
        ctx.moveTo(0, y);
        
        // Create wavy line for grain
        for (let x = 0; x <= canvas.width; x += 20) {
            const yOffset = Math.sin(x * 0.05) * 3 + Math.random() * 4 - 2;
            ctx.lineTo(x, y + yOffset);
        }
        
        ctx.stroke();
    }
    
    // Add some knots
    for (let i = 0; i < 3; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = 5 + Math.random() * 10;
        
        ctx.fillStyle = '#5D3A1A';
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#4A2500';
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

// Create a plot outline with construction elements
export function createPlotOutline(lot, scene) {
    const plotGroup = new THREE.Group();
    plotGroup.name = "plot_outline";
    
    // Create construction tape outline with wooden poles
    const tape = createConstructionTape(lot.width, lot.height, {x: 0, y: 0, z: 0});
    plotGroup.add(tape);
    
    // Create construction cones at corners
    const cones = createConstructionCones(lot.width, lot.height, {x: 0, y: 0, z: 0});
    plotGroup.add(cones);
    
    // Position the entire group at lot position
    plotGroup.position.set(lot.x, 0.1, lot.z);
    
    // Store lot ID in userData for hover detection
    plotGroup.userData = { type: 'lot', id: lot.id };
    
    scene.add(plotGroup);
    
    return plotGroup;
}