class UIScene extends Phaser.Scene {
    constructor() { super('UI'); }

    init(data) { this.gameScene = data.gameScene; }

    create() {
        const W = this.scale.width, H = this.scale.height, D = 20;

        // Speed bar background
        this.add.rectangle(16, H - 20, 134, 12, 0x08080e)
            .setScrollFactor(0).setDepth(D).setOrigin(0, 0.5).setStrokeStyle(1, 0x1a1a2e);
        this.uiFill = this.add.rectangle(17, H - 20, 2, 10, 0xff4400)
            .setScrollFactor(0).setDepth(D + 1).setOrigin(0, 0.5);
        this.add.text(16, H - 34, 'SPEED', {
            fontSize: '6px', color: '#1a1a30', letterSpacing: 3, fontFamily: 'monospace',
        }).setScrollFactor(0).setDepth(D);
        this.uiSpeedNum = this.add.text(156, H - 23, '0', {
            fontSize: '9px', color: '#ff4400', fontFamily: 'monospace',
        }).setScrollFactor(0).setDepth(D).setOrigin(0, 0.5);

        // Air jumps
        this.uiJumps = [];
        for (let i = 0; i < C.MAX_AIR_JUMPS; i++) {
            const pip = this.add.rectangle(16 + i * 12, H - 47, 8, 8, 0x2a2a5a)
                .setScrollFactor(0).setDepth(D).setStrokeStyle(1, 0x3a3a7a);
            this.uiJumps.push(pip);
        }
        this.add.text(16, H - 58, 'JUMPS', {
            fontSize: '5px', color: '#1a1a30', letterSpacing: 2, fontFamily: 'monospace',
        }).setScrollFactor(0).setDepth(D);

        // Dash / attack cooldowns
        this.uiDash = this.add.text(16, H - 70, 'X  DASH  READY', {
            fontSize: '6px', color: '#22226a', letterSpacing: 2, fontFamily: 'monospace',
        }).setScrollFactor(0).setDepth(D);
        this.uiAtk = this.add.text(16, H - 80, 'Z  ATK   READY', {
            fontSize: '6px', color: '#226a22', letterSpacing: 2, fontFamily: 'monospace',
        }).setScrollFactor(0).setDepth(D);
        this.uiSlide = this.add.text(16, H - 90, '', {
            fontSize: '6px', color: '#88aaff', letterSpacing: 2, fontFamily: 'monospace',
        }).setScrollFactor(0).setDepth(D);

        // Weapon name
        const gs  = this.gameScene;
        const wpn = C.WEAPONS[gs.weaponId] || C.WEAPONS.sword;
        const wpnColorHex = '#' + wpn.swingCol.toString(16).padStart(6, '0');
        this.add.text(16, H - 102, wpn.name.toUpperCase(), {
            fontSize: '6px', letterSpacing: 3, fontFamily: 'monospace', color: wpnColorHex,
        }).setScrollFactor(0).setDepth(D);

        // Scythe gauge cost reminder
        if (wpn.id === 'scythe') {
            this.add.text(16, H - 112, 'SWING COSTS 8 SPEED', {
                fontSize: '5px', color: '#551166', letterSpacing: 2, fontFamily: 'monospace',
            }).setScrollFactor(0).setDepth(D);
        }

        // Kill counter
        this.uiKills = this.add.text(W - 16, H - 34, 'KILLS  0', {
            fontSize: '7px', color: '#1a1a2e', letterSpacing: 2, fontFamily: 'monospace',
        }).setScrollFactor(0).setDepth(D).setOrigin(1, 0);

        // Center hit flash (player hits enemy)
        this.uiHit = this.add.text(W / 2, H - 44, '', {
            fontSize: '10px', color: '#ff2200', letterSpacing: 4,
            fontFamily: 'monospace', stroke: '#000', strokeThickness: 4,
        }).setScrollFactor(0).setDepth(D).setOrigin(0.5, 0);

        // Center hit flash (bot hits player) — different color
        this.uiBotHit = this.add.text(W / 2, H / 2 - 60, '', {
            fontSize: '11px', color: '#ff6600', letterSpacing: 3,
            fontFamily: 'monospace', stroke: '#000', strokeThickness: 4,
        }).setScrollFactor(0).setDepth(D).setOrigin(0.5, 0.5);

        // Controls reminder
        this.add.text(W / 2, H - 10, 'ARROWS — MOVE/JUMP/SLIDE    X — DASH    Z — ATTACK    DOWN+Z (AIR) — SLAM (HAMMER)', {
            fontSize: '5px', color: '#0e0e20', letterSpacing: 1, fontFamily: 'monospace',
        }).setScrollFactor(0).setDepth(D).setOrigin(0.5);

        // Events
        gs.events.on('killsUpdated',  (k)   => this.uiKills.setText(`KILLS  ${k}`));
        gs.events.on('hitDmg',        (dmg) => {
            this.uiHit.setText(dmg >= 30 ? `!! ${dmg} !!` : `HIT  ${dmg}`);
            this.time.delayedCall(600, () => this.uiHit.setText(''));
        });
        gs.events.on('botHitPlayer',  (dmg) => {
            this.uiBotHit.setText(`KNOCKED  -${dmg}`).setAlpha(1);
            this.tweens.add({
                targets: this.uiBotHit, alpha: 0, y: this.scale.height / 2 - 80,
                duration: 700, ease: 'Power2',
                onComplete: () => this.uiBotHit.setPosition(this.scale.width / 2, this.scale.height / 2 - 60),
            });
        });
    }

    update() {
        const gs = this.gameScene;
        if (!gs || !gs.player) return;
        const p = gs.player;

        const fw  = Math.max(2, (p.gauge / 100) * 130);
        const col = p.gauge > 85 ? 0xff0000 : p.gauge > 65 ? 0xff3300 : p.gauge > 40 ? 0xff7700 : 0xffbb44;
        this.uiFill.setSize(fw, 10).setFillStyle(col);
        this.uiSpeedNum.setText(Math.round(p.gauge).toString()).setColor(p.gauge > 70 ? '#ff1100' : '#ff5500');

        for (let i = 0; i < C.MAX_AIR_JUMPS; i++)
            this.uiJumps[i].setFillStyle(p.airJumps > i ? 0x1a1a30 : 0x5555cc);

        this.uiDash.setText(p.dashCd <= 0 ? 'X  DASH  READY' : `X  DASH  ${Math.round((1 - p.dashCd / C.DASH_CD) * 100)}%`)
            .setColor(p.dashCd <= 0 ? '#22226a' : '#111128');

        const wpn = p.weaponDef;
        this.uiAtk.setText(p.atkCd <= 0 ? 'Z  ATK   READY' : `Z  ATK   ${Math.round((1 - p.atkCd / wpn.atkCd) * 100)}%`)
            .setColor(p.atkCd <= 0 ? '#226a22' : '#111811');

        this.uiSlide.setText(p.sliding ? 'SLIDING' : p.slamming ? 'SLAM' : '');
    }
}
