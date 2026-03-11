class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }
    init(data) { this.weaponId = data.weaponId || 'sword'; }

    create() {
        // No physics world needed — everything is manual math
        // Camera locked: player always in center of canvas
        this.cameras.main.setScroll(
            C.PLAYER_X - C.CANVAS_W / 2,
            C.PLAYER_Y - C.CANVAS_H / 2
        );

        this.leanX = 0;
        this.leanY = 0;
        this.targetLeanX = 0;
        this.targetLeanY = 0;

        this._buildArena();

        this.effects = new Effects(this);
        this.beat    = new BeatEngine();
        this.player  = new Player(this, this.weaponId);
        this.enemies = [];
        this.waves   = new WaveManager(this);

        this.score      = 0;
        this.combo      = 0;
        this.comboTimer = 0;

        this.hitStopActive = false;
        this.hitStopTimer  = 0;

        // Beat pulse ring
        this.beatRing = this.add.circle(C.PLAYER_X, C.PLAYER_Y, 30, 0, 0)
            .setDepth(7).setStrokeStyle(2, 0xffffff, 0.2);

        this._setupInput();
        this._setupEvents();

        this.beat.onBeat(() => this._onBeat());
        this.beat.start();
        this.waves.startNextWave();

        this.scene.launch('UI', { gameScene: this });
        this.cameras.main.fadeIn(500);
    }

    _buildArena() {
        const W = C.WORLD_W, H = C.WORLD_H;

        // Pure black background
        const bg = this.add.graphics().setDepth(-10);
        bg.fillStyle(0x030303); bg.fillRect(0, 0, W, H);

        // Faint grid
        bg.lineStyle(1, 0x0d0d0d, 1);
        for (let x = 0; x < W; x += 64) bg.lineBetween(x, 0, x, H);
        for (let y = 0; y < H; y += 64) bg.lineBetween(0, y, W, y);

        // Arena floor line — just a visual stripe
        const floor = this.add.graphics().setDepth(-8);
        floor.fillStyle(0x0a0a0a); floor.fillRect(0, C.GROUND_Y, W, H - C.GROUND_Y);
        floor.lineStyle(2, 0x330000, 1); floor.lineBetween(0, C.GROUND_Y, W, C.GROUND_Y);

        // Red glow above floor
        for (let i = 0; i < 12; i++) {
            floor.lineStyle(1, 0x220000, (12 - i) / 12 * 0.4);
            floor.lineBetween(0, C.GROUND_Y - i * 5, W, C.GROUND_Y - i * 5);
        }

        // Arena circle guides
        const rings = this.add.graphics().setDepth(-9);
        rings.lineStyle(1, 0x1a1a1a, 1); rings.strokeCircle(C.PLAYER_X, C.PLAYER_Y + 80, 200);
        rings.lineStyle(1, 0x111111, 1); rings.strokeCircle(C.PLAYER_X, C.PLAYER_Y + 80, 320);
    }

    _setupInput() {
        const kb = this.input.keyboard;
        this.keys = kb.addKeys({
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            left:  Phaser.Input.Keyboard.KeyCodes.LEFT,
            up:    Phaser.Input.Keyboard.KeyCodes.UP,
            down:  Phaser.Input.Keyboard.KeyCodes.DOWN,
            z:     Phaser.Input.Keyboard.KeyCodes.Z,
            x:     Phaser.Input.Keyboard.KeyCodes.X,
            c:     Phaser.Input.Keyboard.KeyCodes.C,
            v:     Phaser.Input.Keyboard.KeyCodes.V,
            m:     Phaser.Input.Keyboard.KeyCodes.M,
            space: Phaser.Input.Keyboard.KeyCodes.SPACE,
            a:     Phaser.Input.Keyboard.KeyCodes.A,
            d:     Phaser.Input.Keyboard.KeyCodes.D,
        });

        // Key → attack + lean
        const map = {
            right: ['right',  1,  0],
            left:  ['left',  -1,  0],
            up:    ['up',     0, -1],
            down:  ['down',   0,  1],
            z:     ['vortex', 0,  0],
            x:     ['parry',  0,  0],
            c:     ['beatBlast', 0, 0],
            v:     ['dashSlash', 0, 0],
            m:     ['shockwave', 0, 0],
            space: ['meteor', 0,  0],
        };

        Object.entries(map).forEach(([k, [atkKey, lx, ly]]) => {
            this.keys[k].on('down', () => {
                this.player.tryAttack(atkKey, this.enemies, this.effects, this.beat);
                if (lx !== 0) { this.targetLeanX = lx; this.player.facing = lx; }
                if (ly !== 0) this.targetLeanY = ly;
            });
        });

        // A/D: lean only
        this.keys.a.on('down', () => { this.targetLeanX = -1; this.player.facing = -1; });
        this.keys.d.on('down', () => { this.targetLeanX =  1; this.player.facing =  1; });
    }

    _setupEvents() {
        this.events.on('enemySpawned',  e    => this.enemies.push(e));
        this.events.on('enemyKilled',   e    => {
            this.score += (C.ENEMY_TYPES[e.typeName]?.score || 100) * Math.max(1, this.combo);
            this.player.heal(e.def.heal);
            this.events.emit('scoreUpdated', this.score);
        });
        this.events.on('playerAttacked', ({ dmg, onBeat }) => {
            this.combo++;
            this.comboTimer = C.COMBO_EXPIRE;
            this.events.emit('comboUpdated', this.combo, onBeat);
        });
        this.events.on('playerDamaged', () => {
            this.combo = 0;
            this.events.emit('comboUpdated', 0, false);
            this.events.emit('hpUpdated', this.player.hp);
        });
        this.events.on('playerDied',    () => this._onPlayerDied());
        this.events.on('waveStarted',   (w, boss) => this.events.emit('uiWave', w, boss));
        this.events.on('waveCleared',   w  => this.events.emit('uiWaveCleared', w));
        this.events.on('hitStop',       ms => { this.hitStopActive = true; this.hitStopTimer = ms; });
        this.events.on('beatMiss',      () => this.events.emit('uiBeatMiss'));
    }

    update(time, delta) {
        if (this.hitStopActive) {
            this.hitStopTimer -= delta;
            if (this.hitStopTimer <= 0) this.hitStopActive = false;
            this.effects.update(delta);
            return;
        }

        // Combo decay
        if (this.comboTimer > 0) {
            this.comboTimer -= delta;
            if (this.comboTimer <= 0) {
                this.combo = 0;
                this.events.emit('comboUpdated', 0, false);
            }
        }

        // Camera lean — smooth interpolation, then decay
        this.leanX = Phaser.Math.Linear(this.leanX, this.targetLeanX * C.CAM_LEAN_MAX, 0.09);
        this.leanY = Phaser.Math.Linear(this.leanY, this.targetLeanY * C.CAM_LEAN_MAX * 0.5, 0.09);
        this.targetLeanX *= 0.88;
        this.targetLeanY *= 0.88;

        this.cameras.main.setScroll(
            C.PLAYER_X - C.CANVAS_W / 2 + this.leanX,
            C.PLAYER_Y - C.CANVAS_H / 2 + this.leanY
        );

        // Updates
        if (!this.player.dead) {
            this.player.update(delta, this.enemies, this.effects, this.beat);
        }

        this.waves.update(delta, this.enemies);

        for (let i = 0; i < this.enemies.length; i++) {
            if (this.enemies[i].alive)
                this.enemies[i].update(delta, C.PLAYER_X, C.PLAYER_Y);
        }
        this.enemies = this.enemies.filter(e => e.alive);

        this.effects.update(delta);
        this._updateBeatRing();
        this.events.emit('hpUpdated', this.player.hp);
    }

    _updateBeatRing() {
        const phase = this.beat.beatPhase();
        const alpha = Math.max(0, 0.6 - phase * 0.6);
        const scale = 1 + (1 - phase) * 0.45;
        this.beatRing.setAlpha(alpha).setScale(scale);
    }

    _onBeat() {
        const active = this.enemies.filter(e => e.alive && !e.ragdoll);
        const n = Math.min(2, Math.floor(active.length * 0.25));
        Phaser.Math.RND.shuffle(active).slice(0, n).forEach(e => e.setBeatWarn());
    }

    _onPlayerDied() {
        this.beat.stop();
        this.cameras.main.flash(400, 255, 0, 0, false);
        this.cameras.main.shake(300, 0.025);

        const cx = C.PLAYER_X, cy = C.PLAYER_Y - 40;
        const t = this.add.text(cx, cy, 'YOU DIED', {
            fontSize: '28px', color: '#ff0000', stroke: '#000',
            strokeThickness: 7, fontFamily: 'monospace', letterSpacing: 10,
        }).setDepth(40).setOrigin(0.5).setScale(0.3);
        this.tweens.add({ targets: t, scaleX: 1.5, scaleY: 1.5, duration: 600, ease: 'Back.Out' });

        const sub = this.add.text(cx, cy + 60, `SCORE  ${this.score.toLocaleString()}`, {
            fontSize: '11px', color: '#ff5500', fontFamily: 'monospace', letterSpacing: 4,
        }).setDepth(40).setOrigin(0.5).setAlpha(0);
        this.time.delayedCall(600, () => this.tweens.add({ targets: sub, alpha: 1, duration: 400 }));

        this.time.delayedCall(3200, () => {
            this.scene.stop('UI');
            this.scene.start('Menu');
        });
    }
}