const C = {
    CANVAS_W: 800,
    CANVAS_H: 480,
    WORLD_W:  1000,
    WORLD_H:  560,
    PLAYER_X: 500,
    PLAYER_Y: 300,
    GROUND_Y: 400,

    CAM_LEAN_MAX: 70,

    BPM:            160,
    BEAT_WINDOW_MS: 85,
    ON_BEAT_MUL:    1.6,
    COMBO_EXPIRE:   2000,

    PLAYER_HP: 100,

    // attack: range, cooldown ms, base damage [min,max], knockback, flags
    ATTACKS: {
        right:     { range:115, cd:260, dmg:[12,28], kx: 600, ky:-100, dir:'R',   label:'SLASH →' },
        left:      { range:115, cd:260, dmg:[12,28], kx:-600, ky:-100, dir:'L',   label:'← SLASH' },
        up:        { range:110, cd:300, dmg:[10,22], kx:  80, ky:-700, dir:'ALL', label:'UPPER ↑' },
        down:      { range:135, cd:460, dmg:[15,35], kx: 220, ky: 300, dir:'ALL', label:'↓ SLAM'  },
        vortex:    { range:148, cd:2000,dmg:[18,38], kx: 440, ky:-180, dir:'ALL', label:'VORTEX [Z]'  },
        parry:     { range: 55, cd:1400,dmg:[40,90], kx: 620, ky:-420, dir:'ALL', label:'PARRY [X]', parry:true },
        beatBlast: { range:240, cd:1600,dmg:[35,80], kx: 500, ky:-280, dir:'ALL', label:'BEAT [C]',  beatOnly:true },
        meteor:    { range:165, cd:4000,dmg:[55,120],kx: 160, ky: 280, dir:'ALL', label:'METEOR [SPC]' },
        dashSlash: { range:210, cd:1200,dmg:[22,48], kx: 460, ky:-200, dir:'ALL', label:'DASH [V]'  },
        shockwave: { range:190, cd:2500,dmg:[ 6,14], kx: 280, ky:-140, dir:'ALL', label:'SHOCK [M]', slow:true },
    },

    WEAPONS: {
        sword:  { id:'sword',  name:'Sword',  dmgMul:1.0, cdMul:1.0,  rangeMul:1.0,  col:0xddeeff, glow:0x88aaff, desc:'Balanced. Fast cooldowns on all attacks.' },
        hammer: { id:'hammer', name:'Hammer', dmgMul:1.8, cdMul:1.55, rangeMul:0.85, col:0xff8844, glow:0xff4400, desc:'Devastating damage. Slower swings.' },
        axe:    { id:'axe',    name:'Axe',    dmgMul:1.2, cdMul:1.1,  rangeMul:1.0,  col:0xaaff55, glow:0x66ff00, desc:'Each kill builds combo multiplier.' },
        scythe: { id:'scythe', name:'Scythe', dmgMul:1.1, cdMul:1.2,  rangeMul:1.45, col:0xcc44ff, glow:0x9900dd, desc:'Massive reach. Cleaves everything near you.' },
    },

    ENEMY_TYPES: {
        grunt:   { hp: 55,  spd: 78,  w:14, h:20, col:0x8a1818, dmg:12, heal: 8, score:100, label:'GRUNT'   },
        charger: { hp: 32,  spd:175,  w:12, h:18, col:0xcc3300, dmg:18, heal: 6, score:150, label:'CHARGER' },
        heavy:   { hp:200,  spd: 36,  w:24, h:28, col:0x3a0808, dmg:32, heal:25, score:400, label:'HEAVY'   },
        swarm:   { hp: 16,  spd:108,  w: 8, h:12, col:0xaa2244, dmg: 8, heal: 3, score: 50, label:'SWARM'   },
        boss:    { hp:550,  spd: 55,  w:34, h:40, col:0x1a0000, dmg:40, heal:40, score:2000,label:'BOSS'    },
    },
};
