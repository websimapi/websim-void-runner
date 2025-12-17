import * as THREE from 'three';
import { Character } from './Character.js';
import { Level } from './Level.js';

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.03); // The Void

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.getElementById('game-container').appendChild(renderer.domElement);

// Lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
scene.add(dirLight);

// Objects
// Point light attached to character
const charLight = new THREE.PointLight(0xffffff, 1, 30);
scene.add(charLight);

const character = new Character(scene);
const level = new Level(scene);

// Menu Environment
const menuStageGeo = new THREE.CylinderGeometry(20, 20, 10, 32, 1, true, -Math.PI/2 - 0.6, 1.2);
const menuStageMat = new THREE.MeshStandardMaterial({ 
    color: 0x111111,
    roughness: 0.2,
    metalness: 0.8,
    side: THREE.DoubleSide
});
const menuStage = new THREE.Mesh(menuStageGeo, menuStageMat);
menuStage.rotation.set(Math.PI / 2, 0, 0); 
menuStage.receiveShadow = true;
scene.add(menuStage);

// Menu Spotlight
const menuLight = new THREE.SpotLight(0xffffff, 8);
menuLight.position.set(0, -10, 5);
menuLight.target.position.set(0, -20, 0);
menuLight.angle = 0.8;
menuLight.penumbra = 0.5;
menuLight.castShadow = true;
scene.add(menuLight);
scene.add(menuLight.target);

// UI
const uiScore = document.getElementById('ui');
const uiGameOver = document.getElementById('game-over');
const uiFinalScore = document.getElementById('final-score');
const restartBtn = document.getElementById('restart-btn');
const hintEl = document.getElementById('controls-hint');
const titleScreen = document.getElementById('title-screen');
const startGameBtn = document.getElementById('start-game-btn');

// Character Creation UI
const swatches = document.querySelectorAll('.swatch');
const sizeSlider = document.getElementById('size-slider');
const speedStat = document.getElementById('speed-stat');
const jumpStat = document.getElementById('jump-stat');

let selectedColor = 0xFFD700;
let selectedSize = 1.0;

swatches.forEach(s => {
    s.addEventListener('click', () => {
        swatches.forEach(sw => sw.classList.remove('selected'));
        s.classList.add('selected');
        selectedColor = parseInt(s.dataset.color);
        character.configure(selectedColor, selectedSize);
    });
});

sizeSlider.addEventListener('input', (e) => {
    selectedSize = parseFloat(e.target.value);
    
    // Update labels
    const speedP = Math.round((1.0 + (1.0 - selectedSize)) * 100);
    const jumpP = Math.round(selectedSize * 100);
    
    speedStat.innerText = `SPEED: ${speedP}%`;
    jumpStat.innerText = `JUMP: ${jumpP}%`;
    
    character.configure(selectedColor, selectedSize);
});

// State
let isRunning = false;
let isGameOver = false;
let inMenu = true;
const clock = new THREE.Clock();
const bgm = new Audio('bgm_space.mp3');
bgm.loop = true;
bgm.volume = 0.5;

startGameBtn.addEventListener('click', () => {
    inMenu = false;
    titleScreen.style.display = 'none';
    uiScore.style.display = 'block';
    hintEl.style.display = 'block';
    menuStage.visible = false;
    menuLight.visible = false;
    level.start();
    character.configure(selectedColor, selectedSize);
    startGame();
});

function startGame() {
    if (isRunning || inMenu) return;
    isRunning = true;
    hintEl.style.opacity = 0;
    bgm.play().catch(()=>{});
}

let touchStartX = 0;
let touchStartY = 0;
let isTouching = false;

window.addEventListener('pointerdown', (e) => {
    if (inMenu) return;
    if (e.target.tagName === 'BUTTON') return;
    if (e.target.closest('#title-screen')) return; 

    isTouching = true;
    touchStartX = e.clientX;
    touchStartY = e.clientY;
    
    if (!isRunning) {
        startGame();
    }
});

window.addEventListener('pointerup', (e) => {
    if (inMenu) return;
    isTouching = false;
    character.steering = 0;
    
    if (isRunning) {
        const dy = e.clientY - touchStartY;
        // Swipe up to jump or Tap
        if (dy < -30) {
            character.jump();
        } else if (Math.abs(e.clientX - touchStartX) < 10 && Math.abs(dy) < 10) {
            character.jump();
        }
    }
});

window.addEventListener('pointermove', (e) => {
    if (inMenu || !isRunning || isGameOver) return;
    if (isTouching) {
        const dx = e.clientX - touchStartX;
        character.steering = Math.max(-1, Math.min(1, dx / 150));
    }
});

const keys = { left: false, right: false };

window.addEventListener('keydown', (e) => {
    if (isGameOver || inMenu) return;
    if (!isRunning) {
        if(['Space','ArrowUp','KeyW','ArrowLeft','ArrowRight'].includes(e.code)) startGame();
    }
    
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') character.jump();
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

restartBtn.addEventListener('click', () => {
    isGameOver = false;
    isRunning = false;
    character.position.set(0, -20, 0);
    character.velocity.set(0, 0, 0);
    character.angle = -Math.PI / 2;
    character.radialPos = 20;
    character.steering = 0;
    character.isGrounded = true;
    
    character.configure(selectedColor, selectedSize);
    
    level.reset();
    level.start(); 
    
    uiGameOver.classList.remove('visible');
    uiScore.innerText = "SCORE: 0";
    hintEl.style.opacity = 1;
});

// Game Loop
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    if (isRunning && !isGameOver) {
        if (keys.left) character.steering = -1;
        else if (keys.right) character.steering = 1;
        else if (!isTouching) character.steering = 0;
    }
    
    const alive = character.update(dt, level.platforms, isRunning, inMenu);
    
    if (!inMenu) {
        level.update(character.position.z);
    }

    // Camera
    if (inMenu) {
        camera.position.set(0, -16, 5);
        camera.lookAt(0, -20, 0);
        camera.up.set(0, 1, 0);
    } else {
        const camDist = 5;
        const camR = character.tubeRadius - camDist;
        const camZOffset = 8;
        
        const cX = camR * Math.cos(character.angle);
        const cY = camR * Math.sin(character.angle);
        const cZ = character.position.z + camZOffset;
        
        camera.position.x += (cX - camera.position.x) * 5 * dt;
        camera.position.y += (cY - camera.position.y) * 5 * dt;
        camera.position.z += (cZ - camera.position.z) * 5 * dt;
        
        const tX = character.tubeRadius * Math.cos(character.angle);
        const tY = character.tubeRadius * Math.sin(character.angle);
        const tZ = character.position.z - 10;
        
        const upVec = new THREE.Vector3(0, 0, cZ).sub(camera.position).normalize();
        camera.up.copy(upVec);
        camera.lookAt(tX, tY, tZ);
    }
    
    charLight.position.copy(character.position);
    charLight.position.z -= 2;
    
    dirLight.position.z = character.position.z + 10;
    dirLight.target.position.z = character.position.z;
    dirLight.target.updateMatrixWorld();

    uiScore.innerText = "SCORE: " + Math.floor(Math.abs(character.position.z));

    if (!alive && !isGameOver) {
        isGameOver = true;
        uiGameOver.classList.add('visible');
        uiFinalScore.innerText = "SCORE: " + Math.floor(Math.abs(character.position.z));
    }
    
    renderer.render(scene, camera);
}

animate();

