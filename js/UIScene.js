class UIScene extends Phaser.Scene {
    constructor() { super('UI'); }
    init(data) { this.gs = data.gameScene; }

    create() {
        const W = this.scale.width, H = this.scale.height;
        const D = 30;

        // ── HP bar ──────────────────────────────────────────────
        this.add.text(16, H - 58, 'HP', {
            fontSize: '6px', color: '#330000', letterSpacing: 3, fontFamily: 'monospace',
        }).setScrollFactor(0).setDepth(D);
        this.add.rectangle(16, H - 44, 140, 10, 0x0a0000)
            .setScrollFactor(0).setDepth(D).setOrigin(0, 0.5).setStrokeStyle(1, 0x220000);
        this.uiHpFill = this.add.rectangle(17, H - 44, 138, 8, 0xff2200)
            .setScrollFactor(0).setDepth(D + 1).setOrigin(0, 0.5);

        // ── Score ───────────────────────────────────────────────
        this.uiScore = this.add.text(W - 16, 16, 'SCORE  0', {
            fontSize: '8px', color: '#220000', letterSpacing: 2, fontFamily: 'monospace',
        }).setScrollFactor(0).setDepth(D).setOrigin(1, 0);

        // ── Wave ────────────────────────────────────────────────
        this.uiWave = this.add.text(W / 2, 16, 'WAVE  1', {
            fontSize: '8px', color: '#221100', letterSpacing: 3, fontFamily: 'monospace',
        }).setScrollFactor(0).setDepth(D).setOrigin(0.5, 0);

        // ── Combo ───────────────────────────────────────────────
        this.uiCombo = this.add.text(W / 2, H - 68, '', {
            fontSize: '20px', color: '#ff3300', fontFamily: 'monospace',
            stroke: '#000', strokeThickness: 5, letterSpacing: 4,
        }).setScrollFactor(0).setDepth(D).setOrigin(0.5, 0).setAlpha(0);

        // ── Beat flash label ─────────────────────────────────────
        this.uiBeat = this.add.text(16, H - 20, '', {
            fontSize: '7px', color: '#ffffff', fontFamily: 'monospace', letterSpacing: 3,
        }).setScrollFactor(0).setDepth(D);

        // ── Attack cooldown grid ─────────────────────────────────
        const atkLabels = [
            ['→', 'right'], ['←', 'left'],   ['↑', 'up'],    ['↓', 'down'],
            ['Z', 'vortex'],['X', 'parry'],   ['C', 'beat'],  ['SPC','meteor'],
            ['V', 'dash'],  ['M', 'shock'],
        ];
        this.cdIcons = {};
        atkLabels.forEach(([label, key], i) => {
            const col = i < 4 ? 0 : Math.floor(i / 2) % 2;
            const row = i < 4 ? 0 : 1 + Math.floor((i - 4) / 2);
            const bx  = 16 + (i < 4 ? i * 38 : ((i - 4) % 2) * 38 + Math.floor((i - 4) / 2) * 0);

            // Simpler: just list them vertically on left side
            const tx = 16, ty = H - 130 - i * 11;
            const t = this.add.text(tx, ty, `${label}  READY`, {
                fontSize: '5.5px', color: '#220000', fontFamily: 'monospace', letterSpacing: 1,
            }).setScrollFactor(0).setDepth(D);
            this.cdIcons[key] = { text: t, label };
        });

        // ── Weapon name ─────────────────────────────────────────
        const gs  = this.gs;
        const wpn = C.WEAPONS[gs.weaponId] || C.WEAPONS.sword;
        this.add.text(16, H - 248, wpn.name.toUpperCase(), {
            fontSize: '7px', letterSpacing: 3, fontFamily: 'monospace',
            color: '#' + wpn.col.toString(16).padStart(6, '0'),
        }).setScrollFactor(0).setDepth(D);

        // Events
        gs.events.on('scoreUpdated',  (s)      => this.uiScore.setText(`SCORE  ${s.toLocaleString()}`));
        gs.events.on('hpUpdated',     (hp)     => this._updateHp(hp));
        gs.events.on('comboUpdated',  (c, ob)  => this._updateCombo(c, ob));
        gs.events.on('uiWave',        (w, boss)=> this._showWave(w, boss));
        gs.events.on('uiWaveCleared', (w)      => this._showWaveCleared(w));
        gs.events.on('uiBeatMiss',    ()       => this._showBeatMiss());
    }

    update() {
        const gs = this.gs;
        if (!gs || !gs.player) return;
        const p = gs.player;

        // Update cooldown display
        const atkKeys = ['right','left','up','down','vortex','parry','beatBlast','meteor','dashSlash','shockwave'];
        const dispKeys= ['right','left','up','down','vortex','parry','beat','meteor','dash','shock'];
        atkKeys.forEach((ak, i) => {
            const dk   = dispKeys[i];
            const icon = this.cdIcons[dk];
            if (!icon) return;
            const cd  = p.cds[ak] || 0;
            const atk = C.ATTACKS[ak];
            if (!atk) return;
            const maxCd = Math.round(atk.cd * (gs.weaponId ? C.WEAPONS[gs.weaponId].cdMul : 1));
            if (cd <= 0) {
                icon.text.setText(`${icon.label}  READY`).setColor('#440000');
            } else {
                const pct = Math.round((1 - cd / maxCd) * 100);
                icon.text.setText(`${icon.label}  ${pct}%`).setColor('#1a0000');
            }
        });

        // Beat phase indicator on the beat label
        const phase = gs.beat ? gs.beat.beatPhase() : 0;
        if (phase < 0.15) {
            this.uiBeat.setText('♦ BEAT').setColor('#ffffff');
        } else {
            this.uiBeat.setText('♦ BEAT').setColor('#' + Math.round((1 - phase) * 0x22).toString(16).padStart(2,'0') + '0000');
        }
    }

    _updateHp(hp) {
        const pct = Math.max(0, hp / C.PLAYER_HP);
        this.uiHpFill.setSize(Math.max(2, pct * 138), 8);
        const col = pct > 0.5 ? 0xff2200 : pct > 0.25 ? 0xff6600 : 0xff0000;
        this.uiHpFill.setFillStyle(col);
    }

    _updateCombo(c, onBeat) {
        if (c <= 1) {
            this.tweens.add({ targets: this.uiCombo, alpha: 0, duration: 400 });
            return;
        }
        const col = onBeat ? '#ffffff' : c > 10 ? '#ff0000' : c > 5 ? '#ff5500' : '#ff9900';
        this.uiCombo.setText(`x${c} COMBO`).setColor(col).setAlpha(1);
        this.uiCombo.setScale(onBeat ? 1.3 : 1);
        if (onBeat) this.tweens.add({ targets: this.uiCombo, scaleX: 1, scaleY: 1, duration: 200 });
    }

    _showWave(w, isBoss) {
        const cx = this.scale.width / 2, cy = this.scale.height / 2 - 60;
        const label = isBoss ? `⚠ WAVE ${w}  BOSS ⚠` : `WAVE  ${w}`;
        const col   = isBoss ? '#ff0000' : '#ffffff';
        const t = this.add.text(cx, cy, label, {
            fontSize: isBoss ? '18px' : '14px', color: col,
            stroke: '#000', strokeThickness: 5, fontFamily: 'monospace', letterSpacing: 6,
        }).setScrollFactor(0).setDepth(35).setOrigin(0.5).setScale(0.4);
        this.tweens.add({
            targets: t, scaleX: 1.2, scaleY: 1.2, y: cy - 20, alpha: 0,
            duration: isBoss ? 1600 : 1200, ease: 'Back.Out', onComplete: () => t.destroy(),
        });
        this.uiWave.setText(`WAVE  ${w}`);
    }

    _showWaveCleared(w) {
        const cx = this.scale.width / 2, cy = this.scale.height / 2 - 40;
        const t = this.add.text(cx, cy, 'WAVE CLEARED', {
            fontSize: '12px', color: '#00ff88', stroke: '#000',
            strokeThickness: 4, fontFamily: 'monospace', letterSpacing: 5,
        }).setScrollFactor(0).setDepth(35).setOrigin(0.5).setScale(0.5);
        this.tweens.add({ targets: t, scaleX: 1.1, scaleY: 1.1, y: cy - 20, alpha: 0, duration: 1400, ease: 'Back.Out', onComplete: () => t.destroy() });
    }

    _showBeatMiss() {
        const t = this.add.text(this.scale.width / 2, this.scale.height / 2 + 20, 'NOT ON BEAT', {
            fontSize: '9px', color: '#ff4400', fontFamily: 'monospace', letterSpacing: 3,
            stroke: '#000', strokeThickness: 3,
        }).setScrollFactor(0).setDepth(35).setOrigin(0.5).setAlpha(0.9);
        this.tweens.add({ targets: t, alpha: 0, y: t.y - 20, duration: 600, onComplete: () => t.destroy() });
    }
}
