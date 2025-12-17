import * as THREE from 'three';
import { createLimb, createJoint } from './Utils.js';

export class Character {
    constructor(scene) {
        this.scene = scene;
        this.position = new THREE.Vector3(0, -20, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        
        // Tube State
        this.tubeRadius = 20;
        this.angle = -Math.PI / 2;
        this.radialPos = this.tubeRadius;
        this.steering = 0;

        this.isGrounded = false;
        
        // Visual Rig
        this.mesh = new THREE.Group();
        this.parts = {};
        this.scene.add(this.mesh);
        
        this.initRig();
        
        // Game State
        this.time = 0;
        
        // Physics
        this.gravity = 40; // Pulls Outwards
        this.jumpForce = -15; // Pushes Inwards
        this.radialVelocity = 0;
        
        this.baseRunSpeed = 20;
        this.runSpeed = 20;
        this.scale = 1.0;
        
        this.jumpCount = 0;
        this.maxJumps = 2;

        this.isClimbing = false; // Disabled for tube
        // Menu Animation State
        this.menuTime = 0;
    }

    initRig() {
        const color = 0xFFD700; // Warning Yellow
        const jointColor = 0x222222;

        // Hips (Root of body parts)
        this.parts.hips = new THREE.Group();
        this.parts.hips.position.y = 1.0;
        this.mesh.add(this.parts.hips);

        // Torso
        // Create upside down so pivot is at hips
        const torso = createLimb(0.12, 0.5, color);
        torso.pivot.rotation.z = Math.PI; 
        torso.pivot.position.y = 0; 
        this.parts.hips.add(torso.pivot);
        this.parts.torso = torso.pivot;

        // Head
        const head = createJoint(0.22, color);
        head.position.set(0, 0.65, 0); // Above hips
        this.parts.hips.add(head);

        // Arms
        this.parts.armL = this.createArm(-1, color, jointColor);
        this.parts.armR = this.createArm(1, color, jointColor);
        
        const shoulderY = 0.5;
        const shoulderX = 0.2;
        this.parts.armL.upper.position.set(-shoulderX, shoulderY, 0);
        this.parts.armR.upper.position.set(shoulderX, shoulderY, 0);
        
        this.parts.hips.add(this.parts.armL.upper);
        this.parts.hips.add(this.parts.armR.upper);

        // Legs
        this.parts.legL = this.createLeg(-1, color, jointColor);
        this.parts.legR = this.createLeg(1, color, jointColor);
        
        const hipX = 0.1;
        this.parts.legL.upper.position.set(-hipX, 0, 0);
        this.parts.legR.upper.position.set(hipX, 0, 0);
        
        this.parts.hips.add(this.parts.legL.upper);
        this.parts.hips.add(this.parts.legR.upper);
    }

    createArm(side, color, jointColor) {
        const uLen = 0.35, lLen = 0.35;
        const upper = createLimb(0.08, uLen, color);
        const lower = createLimb(0.08, lLen, color);
        const joint = createJoint(0.1, jointColor);
        
        lower.pivot.position.y = -uLen;
        joint.position.y = -uLen;
        
        upper.pivot.add(joint);
        upper.pivot.add(lower.pivot);
        return { upper: upper.pivot, lower: lower.pivot };
    }

    createLeg(side, color, jointColor) {
        const uLen = 0.45, lLen = 0.45;
        const upper = createLimb(0.1, uLen, color);
        const lower = createLimb(0.1, lLen, color);
        const joint = createJoint(0.12, jointColor);
        
        lower.pivot.position.y = -uLen;
        joint.position.y = -uLen;
        
        upper.pivot.add(joint);
        upper.pivot.add(lower.pivot);
        return { upper: upper.pivot, lower: lower.pivot };
    }

    configure(colorHex, size) {
        this.scale = size;
        this.mesh.scale.setScalar(this.scale);

        const speedFactor = 1.0 + (1.0 - this.scale);
        const jumpFactor = this.scale;

        this.runSpeed = this.baseRunSpeed * speedFactor;
        this.jumpForce = -15 * jumpFactor; // Negative for inward jump

        // Apply Color
        this.mesh.traverse((child) => {
            if (child.isMesh && child.geometry.type === 'CapsuleGeometry') {
                child.material.color.setHex(colorHex);
            }
        });
    }

    jump() {
        if (this.isGrounded || this.jumpCount < this.maxJumps) {
            this.radialVelocity = this.jumpForce;
            this.isGrounded = false;
            this.jumpCount++;
            
            const sound = new Audio('jump.mp3');
            if (this.jumpCount > 1) sound.playbackRate = 1.25;
            sound.play().catch(()=>{});
        }
    }

    update(dt, platforms, isRunning, inMenu = false) {
        if (inMenu) {
            this.animateMenu(dt);
            this.angle = -Math.PI/2;
            this.updateMeshPosition();
            return true;
        }

        if (isRunning) {
            this.angle += this.steering * 2.0 * dt;
            this.runSpeed += dt * 0.05;
            this.time += dt * this.runSpeed;
            this.position.z -= this.runSpeed * dt;

            // Gravity
            this.radialVelocity += this.gravity * dt;
            this.radialPos += this.radialVelocity * dt;

            const alive = this.checkCollisions(platforms);
            
            this.animateRun();
            this.updateMeshPosition();
            
            return alive;
        } else {
            this.time += dt * 2; 
            this.animateIdle();
            this.updateMeshPosition();
            return true;
        }
    }

    updateMeshPosition() {
        this.position.x = this.radialPos * Math.cos(this.angle);
        this.position.y = this.radialPos * Math.sin(this.angle);
        
        this.mesh.position.copy(this.position);
        
        // Align orientation
        this.mesh.rotation.set(0, 0, this.angle - Math.PI / 2);
        this.mesh.rotateY(Math.PI); 
    }

    animateMenu(dt) {
        this.menuTime += dt;
        
        // Smooth cycle: Idle -> Warmup -> Run -> CoolDown
        const cycle = 8;
        const t = this.menuTime % cycle;
        
        // Calculate transition factor (0 = idle, 1 = run)
        // using a smoothstep curve for fluid blending
        let runFactor = 0;
        if (t > 2.5 && t < 6.5) {
            if (t < 3.5) runFactor = (t - 2.5); // 0 to 1 over 1s
            else if (t > 5.5) runFactor = (6.5 - t); // 1 to 0 over 1s
            else runFactor = 1;
        }
        // Apply easing to make it less linear
        runFactor = runFactor * runFactor * (3 - 2 * runFactor);

        // Update internal animation time based on activity level
        // Idle is slow (2x), Run is fast (based on runSpeed)
        const speed = 2 * (1 - runFactor) + (this.runSpeed * 0.8) * runFactor;
        this.time += dt * speed;
        
        const time = this.time;
        
        // --- Calculate & Blend Rotations ---
        
        // Hips Y (Bobbing height)
        const idleHipsY = 1.0 + Math.sin(time * 0.5) * 0.03;
        const runHipsY = 1.0 + Math.abs(Math.sin(time)) * 0.1;
        this.parts.hips.position.y = THREE.MathUtils.lerp(idleHipsY, runHipsY, runFactor);

        // Body Lean
        this.mesh.rotation.x = THREE.MathUtils.lerp(0, 0.2, runFactor);

        // Arms
        // Idle Arm Swing
        const iArmL = Math.sin(time * 0.5) * 0.05;
        const iArmR = -Math.sin(time * 0.5) * 0.05;
        // Run Arm Swing
        const rArmL = Math.sin(time + Math.PI) * 1.0;
        const rArmR = Math.sin(time) * 1.0;
        
        this.parts.armL.upper.rotation.x = THREE.MathUtils.lerp(iArmL, rArmL, runFactor);
        this.parts.armR.upper.rotation.x = THREE.MathUtils.lerp(iArmR, rArmR, runFactor);
        
        // Forearms
        this.parts.armL.lower.rotation.x = THREE.MathUtils.lerp(-0.1, -1.5, runFactor);
        this.parts.armR.lower.rotation.x = THREE.MathUtils.lerp(-0.1, -1.5, runFactor);

        // Legs
        // Idle Legs (Stand still)
        const iLeg = 0;
        // Run Legs
        const rLegL = Math.sin(time) * 1.2;
        const rLegR = Math.sin(time + Math.PI) * 1.2;
        
        this.parts.legL.upper.rotation.x = THREE.MathUtils.lerp(iLeg, rLegL, runFactor);
        this.parts.legR.upper.rotation.x = THREE.MathUtils.lerp(iLeg, rLegR, runFactor);
        
        // Knees
        const rKneeL = Math.max(0, Math.sin(time - 1.5) * 2.2);
        const rKneeR = Math.max(0, Math.sin(time + Math.PI - 1.5) * 2.2);
        
        this.parts.legL.lower.rotation.x = THREE.MathUtils.lerp(0, rKneeL, runFactor);
        this.parts.legR.lower.rotation.x = THREE.MathUtils.lerp(0, rKneeR, runFactor);

        // Ensure grounded Y
        this.position.y = 0;
    }

    checkCollisions(platforms) {
        this.isGrounded = false;
        
        const floorR = this.tubeRadius;
        const feetR = this.radialPos;
        
        // Check ground collision
        if (feetR >= floorR) {
            let onPlatform = false;
            let normAngle = Math.atan2(Math.sin(this.angle), Math.cos(this.angle));
            
            for (const p of platforms) {
                if (this.position.z < p.z + p.depth/2 && this.position.z > p.z - p.depth/2) {
                    let diff = Math.atan2(Math.sin(normAngle - p.angle), Math.cos(normAngle - p.angle));
                    if (Math.abs(diff) < p.widthAngle / 2 + 0.1) { // 0.1 buffer
                        onPlatform = true;
                        break;
                    }
                }
            }
            
            if (onPlatform) {
                this.radialPos = floorR;
                this.radialVelocity = 0;
                this.isGrounded = true;
                this.jumpCount = 0;
            } else {
                if (feetR > floorR + 5) return false; 
            }
        }
        return true;
    }

    animateRun() {
        const t = this.time;
        
        if (this.isGrounded) {
            this.parts.hips.position.y = 1.0 + Math.abs(Math.sin(t*2)) * 0.05;
            this.mesh.rotation.x = 0.25; // Lean
            
            // Arms
            this.parts.armL.upper.rotation.x = Math.sin(t + Math.PI) * 0.8;
            this.parts.armL.lower.rotation.x = -1.2; 
            this.parts.armR.upper.rotation.x = Math.sin(t) * 0.8;
            this.parts.armR.lower.rotation.x = -1.2;

            // Legs
            this.parts.legL.upper.rotation.x = Math.sin(t) * 1.0;
            this.parts.legL.lower.rotation.x = Math.max(0, Math.sin(t - 1.5) * 2.2);
            
            this.parts.legR.upper.rotation.x = Math.sin(t + Math.PI) * 1.0;
            this.parts.legR.lower.rotation.x = Math.max(0, Math.sin(t + Math.PI - 1.5) * 2.2);
        } else {
            // Jump
            this.parts.legL.upper.rotation.x = 0.8;
            this.parts.legL.lower.rotation.x = 0.5;
            this.parts.legR.upper.rotation.x = -0.5;
            this.parts.legR.lower.rotation.x = 0.5;
            this.mesh.rotation.x = 0;
            this.parts.armL.upper.rotation.x = -2.5;
            this.parts.armR.upper.rotation.x = -2.5;
        }
    }

    animateIdle() {
        const t = this.time;
        this.parts.hips.position.y = 1.0 + Math.sin(t) * 0.02;
        this.mesh.rotation.x = 0;
        
        this.parts.armL.upper.rotation.x = Math.sin(t) * 0.05;
        this.parts.armL.lower.rotation.x = -0.1;
        this.parts.armR.upper.rotation.x = -Math.sin(t) * 0.05;
        this.parts.armR.lower.rotation.x = -0.1;
        
        this.parts.legL.upper.rotation.x = 0;
        this.parts.legR.upper.rotation.x = 0;
    }
}

