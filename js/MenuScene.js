class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }

    create() {
        const W = this.scale.width, H = this.scale.height;
        this.add.rectangle(W / 2, H / 2, W, H, 0x050505);
        const g = this.add.graphics();
        g.lineStyle(1, 0x0d0d0d, 1);
        for (let x = 0; x < W; x += 60) g.lineBetween(x, 0, x, H);
        for (let y = 0; y < H; y += 60) g.lineBetween(0, y, W, y);

        // Title
        this.add.text(W / 2, 44, 'MOMENTUM', {
            fontSize: '30px', color: '#ffffff', fontFamily: 'monospace',
            stroke: '#ff0000', strokeThickness: 3, letterSpacing: 10,
        }).setOrigin(0.5);
        this.add.text(W / 2, 82, 'ARENA  SURVIVAL', {
            fontSize: '8px', color: '#330000', fontFamily: 'monospace', letterSpacing: 6,
        }).setOrigin(0.5);

        // Controls cheatsheet
        const controls = [
            '→ ← ↑ ↓   DIRECTIONAL ATTACKS',
            'Z  VORTEX SPIN     X  PARRY',
            'C  BEAT BLAST      SPC  METEOR',
            'V  DASH SLASH      M  SHOCKWAVE',
            'A / D   CAMERA LEAN',
        ];
        controls.forEach((line, i) => {
            this.add.text(W / 2, H - 88 + i * 14, line, {
                fontSize: '6px', color: '#1a0000', fontFamily: 'monospace', letterSpacing: 2,
            }).setOrigin(0.5);
        });

        const weapons = Object.values(C.WEAPONS);
        const cardW   = 155, cardH = 195;
        const total   = weapons.length;
        const spacing = Math.min(175, (W - 60) / total);
        const startX  = W / 2 - spacing * (total - 1) / 2;

        this.selected = 0;
        this.cards    = [];

        weapons.forEach((wpn, i) => {
            const cx = startX + i * spacing, cy = H / 2 + 10;
            const card = this.add.container(cx, cy);
            const bg   = this.add.rectangle(0, 0, cardW, cardH, 0x0a0a0a).setStrokeStyle(1, 0x1a1a1a);
            const icon = this._weaponIcon(wpn, 0, -52);
            const name = this.add.text(0, -10, wpn.name.toUpperCase(), {
                fontSize: '10px', color: '#ffffff', fontFamily: 'monospace', letterSpacing: 3,
            }).setOrigin(0.5);
            const statLine = this._statLine(wpn);
            const desc = this.add.text(0, 22, wpn.desc, {
                fontSize: '6.5px', color: '#332222', fontFamily: 'monospace',
                align: 'center', wordWrap: { width: cardW - 20 },
            }).setOrigin(0.5, 0);
            const key = this.add.text(0, 82, `[${i + 1}]`, {
                fontSize: '9px', color: '#1a1a1a', fontFamily: 'monospace',
            }).setOrigin(0.5);
            card.add([bg, icon, name, statLine, desc, key]);
            this.cards.push({ container: card, bg, wpn });
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerover', () => this._select(i));
            bg.on('pointerdown', () => this._start(weapons[this.selected].id));
        });

        this.add.text(W / 2, H - 14, 'CLICK CARD OR PRESS 1–4    ENTER TO START', {
            fontSize: '6px', color: '#110000', fontFamily: 'monospace', letterSpacing: 2,
        }).setOrigin(0.5);

        this.input.keyboard.on('keydown-ONE',   () => this._select(0));
        this.input.keyboard.on('keydown-TWO',   () => this._select(1));
        this.input.keyboard.on('keydown-THREE', () => this._select(2));
        this.input.keyboard.on('keydown-FOUR',  () => this._select(3));
        this.input.keyboard.on('keydown-ENTER', () => this._start(weapons[this.selected].id));
        this._select(0);
    }

    _statLine(wpn) {
        const dmg   = Math.round(wpn.dmgMul * 10) / 10;
        const spd   = Math.round((2 - wpn.cdMul) * 10) / 10;
        const range = Math.round(wpn.rangeMul * 10) / 10;
        const txt = `DMG ${dmg}×  SPD ${spd}×  RNG ${range}×`;
        return this.add.text(0, 6, txt, {
            fontSize: '6px', color: '#331111', fontFamily: 'monospace', letterSpacing: 1,
        }).setOrigin(0.5);
    }

    _weaponIcon(wpn, x, y) {
        const g = this.add.graphics(); g.x = x; g.y = y;
        const c = wpn.col;
        if (wpn.id === 'sword') {
            g.lineStyle(3, c, 1); g.lineBetween(-2, 20, 2, -20);
            g.lineStyle(2, c, 0.5); g.lineBetween(-10, 2, 10, 2);
            g.fillStyle(c, 0.3); g.fillCircle(0, -18, 4);
        } else if (wpn.id === 'hammer') {
            g.lineStyle(5, c, 1); g.lineBetween(0, 20, 0, -4);
            g.fillStyle(c, 1); g.fillRect(-12, -18, 24, 14);
            g.lineStyle(1, 0xffffff, 0.2); g.strokeRect(-12, -18, 24, 14);
        } else if (wpn.id === 'axe') {
            g.lineStyle(3, c, 1); g.lineBetween(-2, 20, 2, -12);
            g.fillStyle(c, 0.9); g.fillTriangle(2, -12, 18, -22, 16, 2);
            g.lineStyle(2, 0xffffff, 0.2); g.lineBetween(2, -12, 18, -22);
        } else if (wpn.id === 'scythe') {
            g.lineStyle(3, 0x886622, 1); g.lineBetween(4, 22, -4, -8);
            g.lineStyle(3, c, 1);
            g.lineBetween(-4, -8, 10, -20);
            g.lineBetween(10, -20, 18, -10);
            g.lineBetween(18, -10, 10, 2);
            g.lineStyle(1, wpn.glow, 0.6); g.lineBetween(10, -18, 16, -10);
        }
        return g;
    }

    _select(i) {
        if (i >= this.cards.length) return;
        this.selected = i;
        this.cards.forEach((c, idx) => {
            const active = idx === this.selected;
            const col = active ? c.wpn.col : 0x1a1a1a;
            c.bg.setStrokeStyle(active ? 2 : 1, col);
            c.bg.setFillStyle(active ? 0x110808 : 0x0a0a0a);
        });
    }

    _start(weaponId) {
        this.cameras.main.fade(300, 0, 0, 0);
        this.time.delayedCall(310, () => this.scene.start('Game', { weaponId }));
    }
}
