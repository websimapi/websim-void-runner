import * as THREE from 'three';

export class Level {
    constructor(scene) {
        this.scene = scene;
        this.platforms = [];
        this.pool = [];
        this.spawnZ = -20; 
        this.tubeRadius = 20;
        
        // Colors for the "Run" aesthetic (Grey tiles)
        this.colorA = 0x666666;
        this.colorB = 0x555555;
        this.material = new THREE.MeshStandardMaterial({ 
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true
        });

        // Start platform - Full Ring
        this.addPlatform(0, 0, 0, Math.PI * 2, 50); 
    }

    addPlatform(angle, y_unused, z, widthAngle, depth) {
        let mesh = this.pool.pop();
        if (!mesh) {
            const geometry = new THREE.BoxGeometry(1, 1, 1);
            mesh = new THREE.Mesh(geometry, this.material.clone());
            mesh.receiveShadow = true;
            this.scene.add(mesh);
        } else {
            mesh.visible = true;
        }

        const chordWidth = 2 * (this.tubeRadius + 1) * Math.sin(widthAngle / 2);
        const thickness = 2;

        mesh.scale.set(chordWidth, thickness, depth);
        
        const r = this.tubeRadius + thickness / 2;
        
        mesh.position.x = r * Math.cos(angle);
        mesh.position.y = r * Math.sin(angle);
        mesh.position.z = z;
        
        mesh.rotation.set(0, 0, angle - Math.PI / 2);

        // Checkerboard Pattern
        const tileIndex = Math.floor(Math.abs(z) / 10);
        mesh.material.color.setHex(tileIndex % 2 === 0 ? this.colorA : this.colorB);
        
        this.platforms.push({ mesh, angle, widthAngle, z, depth });
    }

    update(playerZ) {
        // Remove old
        const removeThreshold = playerZ + 30;
        for (let i = this.platforms.length - 1; i >= 0; i--) {
            const p = this.platforms[i];
            if (p.z > removeThreshold) {
                p.mesh.visible = false;
                this.pool.push(p.mesh);
                this.platforms.splice(i, 1);
            }
        }

        // Spawn new
        const spawnThreshold = playerZ - 120;
        while (this.spawnZ > spawnThreshold) {
            this.spawnPattern();
        }
    }

    spawnPattern() {
        const length = 15 + Math.random() * 20;
        const gap = 4 + Math.random() * 5;
        const zPos = this.spawnZ - length / 2;
        
        const r = Math.random();

        if (r < 0.3) {
            // Full Ring
            this.addPlatform(0, 0, zPos, Math.PI * 2, length);
        } else if (r < 0.6) {
            // Halves
            const gapAngle = 0.5;
            const w = Math.PI - gapAngle;
            const offset = Math.random() * Math.PI;
            this.addPlatform(offset, 0, zPos, w, length);
            this.addPlatform(offset + Math.PI, 0, zPos, w, length);
        } else if (r < 0.8) {
            // Three panels
            const offset = Math.random() * Math.PI;
            for(let i=0; i<3; i++) {
                this.addPlatform(offset + (i * Math.PI * 2 / 3), 0, zPos, 1.5, length);
            }
        } else {
            // Scattered steps
            const count = 4 + Math.floor(Math.random() * 4);
            const stepLen = length / count;
            for(let i=0; i<count; i++) {
                const a = Math.random() * Math.PI * 2;
                this.addPlatform(a, 0, zPos - (i*stepLen), 1.5, stepLen);
            }
        }

        this.spawnZ -= (length + gap);
    }

    reset() {
        this.platforms.forEach(p => {
            p.mesh.visible = false;
            this.pool.push(p.mesh);
        });
        this.platforms = [];
        this.spawnZ = -20;
        this.addPlatform(0, 0, 0, Math.PI * 2, 50);
    }

    start() {
        // Ensure start platform is visible
        if (this.platforms.length > 0) {
            this.platforms[0].mesh.visible = true;
        }
    }
}

