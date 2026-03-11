class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }
    init(data) { this.weaponId = data.weaponId || 'sword'; }

    create() {
        this.physics.world.setBounds(0, 0, C.WORLD_W, C.WORLD_H);
        this.cameras.main.setBounds(0, 0, C.WORLD_W, C.WORLD_H);

        // Base camera scroll: center player on canvas
        this.baseCamX = C.PLAYER_X - C.CANVAS_W / 2;
        this.baseCamY = C.PLAYER_Y - C.CANVAS_H / 2;
        this.cameras.main.setScroll(this.baseCamX, this.baseCamY);

        this.leanX = 0; this.leanY = 0;
        this.targetLeanX = 0; this.targetLeanY = 0;

        this._buildArena();

        this.effects  = new Effects(this);
        this.beat     = new BeatEngine();
        this.player   = new Player(this, this.weaponId);
        this.enemies  = [];
        this.waves    = new WaveManager(this);
        this.score    = 0;
        this.combo    = 0;
        this.comboTimer = 0;
        this.hitStopActive = false;
        this.hitStopTimer  = 0;

        this._setupInput();
        this._setupEvents();

        // Beat pulse ring around player
        this.beatRing = this.add.circle(C.PLAYER_X, C.PLAYER_Y, 28, 0, 0)
            .setDepth(7).setStrokeStyle(2, 0xffffff, 0.15);

        this.beat.onBeat(() => this._onBeat());
        this.beat.start();

        this.waves.startNextWave();

        this.scene.launch('UI', { gameScene: this });
        this.cameras.main.fadeIn(500);
    }

    _buildArena() {
        // Background
        const bg = this.add.graphics().setDepth(-10);
        bg.fillStyle(0x050505); bg.fillRect(0, 0, C.WORLD_W, C.WORLD_H);

        // Subtle grid
        bg.lineStyle(1, 0x111111, 1);
        for (let x = 0; x < C.WORLD_W; x += 60) bg.lineBetween(x, 0, x, C.WORLD_H);
        for (let y = 0; y < C.WORLD_H; y += 60) bg.lineBetween(0, y, C.WORLD_W, y);

        // Arena circle
        const arena = this.add.graphics().setDepth(-9);
        arena.lineStyle(1, 0x222222, 1);
        arena.strokeCircle(C.PLAYER_X, C.PLAYER_Y + 60, 280);
        arena.lineStyle(1, 0x1a1a1a, 1);
        arena.strokeCircle(C.PLAYER_X, C.PLAYER_Y + 60, 180);

        // Ground
        const ground = this.add.graphics().setDepth(-8);
        ground.fillStyle(0x0d0d0d); ground.fillRect(0, C.GROUND_Y, C.WORLD_W, C.WORLD_H - C.GROUND_Y);
        ground.lineStyle(2, 0x330000, 1); ground.lineBetween(0, C.GROUND_Y, C.WORLD_W, C.GROUND_Y);

        // Red edge vignette suggestion
        for (let i = 0; i < 8; i++) {
            ground.lineStyle(1, 0x1a0000, (8 - i) / 8 * 0.3);
            ground.lineBetween(0, C.GROUND_Y - i * 4, C.WORLD_W, C.GROUND_Y - i * 4);
        }
    }

    _setupInput() {
        this.keys = this.input.keyboard.addKeys({
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

        // Map key → attack
        const keyMap = {
            right: 'right', left: 'left', up: 'up', down: 'down',
            z: 'vortex', x: 'parry', c: 'beatBlast',
            v: 'dashSlash', m: 'shockwave', space: 'meteor',
        };

        Object.entries(keyMap).forEach(([k, atkKey]) => {
            this.keys[k].on('down', () => {
                this.player.tryAttack(atkKey, this.enemies, this.effects, this.beat);
                // Set lean toward attack direction
                if (atkKey === 'right') { this.targetLeanX =  1; this.player.facing =  1; }
                if (atkKey === 'left')  { this.targetLeanX = -1; this.player.facing = -1; }
                if (atkKey === 'up')    { this.targetLeanY = -1; }
                if (atkKey === 'down')  { this.targetLeanY =  1; }
            });
        });

        // A/D: camera lean only (no attack)
        this.keys.a.on('down', () => { this.targetLeanX = -1; this.player.facing = -1; });
        this.keys.d.on('down', () => { this.targetLeanX =  1; this.player.facing =  1; });
    }

    _setupEvents() {
        this.events.on('enemySpawned', (e) => {
            this.enemies.push(e);
        });
        this.events.on('enemyKilled', (e) => {
            this.score += this._scoreForKill(e) * Math.max(1, this.combo);
            this.player.heal(e.def.heal);
            this.events.emit('scoreUpdated', this.score);
        });
        this.events.on('playerAttacked', ({ dmg, onBeat, key, enemyKilled }) => {
            this.combo++;
            this.comboTimer = C.COMBO_EXPIRE;
            this.events.emit('comboUpdated', this.combo, onBeat);
        });
        this.events.on('playerDamaged', (dmg) => {
            this.combo = 0;
            this.events.emit('comboUpdated', 0, false);
            this.events.emit('hpUpdated', this.player.hp);
        });
        this.events.on('playerDied', () => this._onPlayerDied());
        this.events.on('waveStarted', (w, isBoss) => this.events.emit('uiWave', w, isBoss));
        this.events.on('waveCleared', (w) => this.events.emit('uiWaveCleared', w));
        this.events.on('hitStop', (ms) => { this.hitStopActive = true; this.hitStopTimer = ms; });
        this.events.on('beatMiss', () => this.events.emit('uiBeatMiss'));
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

        // Camera lean toward input direction
        const lerpRate = 0.08;
        this.leanX = Phaser.Math.Linear(this.leanX, this.targetLeanX * C.CAM_LEAN_MAX, lerpRate);
        this.leanY = Phaser.Math.Linear(this.leanY, this.targetLeanY * C.CAM_LEAN_MAX * 0.55, lerpRate);
        this.targetLeanX *= 0.92; // decay lean
        this.targetLeanY *= 0.92;
        this.cameras.main.setScroll(this.baseCamX + this.leanX, this.baseCamY + this.leanY);

        this.player.update(delta, this.enemies, this.effects, this.beat);
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
        // Pulses on beat (phase near 0), fades out
        const alpha = Math.max(0, 0.55 - phase * 0.55);
        const scale = 1 + (1 - phase) * 0.4;
        this.beatRing.setAlpha(alpha).setScale(scale);
    }

    _onBeat() {
        // Warn random enemies they'll attack on next beat
        const active = this.enemies.filter(e => e.alive && !e.ragdoll);
        const warnCount = Math.min(2, Math.floor(active.length * 0.3));
        Phaser.Math.RND.shuffle(active).slice(0, warnCount).forEach(e => e.setBeatWarn());
    }

    _scoreForKill(enemy) {
        return C.ENEMY_TYPES[enemy.typeName]?.score || 100;
    }

    _onPlayerDied() {
        this.beat.stop();
        const cam = this.cameras.main;
        cam.flash(400, 255, 0, 0, false);
        cam.shake(300, 0.025);

        const cx = cam.scrollX + C.CANVAS_W / 2;
        const cy = cam.scrollY + C.CANVAS_H / 2;
        const t = this.add.text(cx, cy, 'YOU DIED', {
            fontSize: '28px', color: '#ff0000', stroke: '#000',
            strokeThickness: 7, fontFamily: 'monospace', letterSpacing: 10,
        }).setDepth(40).setOrigin(0.5).setScale(0.3);
        this.tweens.add({ targets: t, scaleX: 1.5, scaleY: 1.5, alpha: 0.9, duration: 600, ease: 'Back.Out' });

        const sub = this.add.text(cx, cy + 60, `SCORE  ${this.score.toLocaleString()}`, {
            fontSize: '10px', color: '#ff5500', fontFamily: 'monospace', letterSpacing: 4,
        }).setDepth(40).setOrigin(0.5).setAlpha(0);
        this.time.delayedCall(600, () => this.tweens.add({ targets: sub, alpha: 1, duration: 400 }));

        this.time.delayedCall(3000, () => {
            this.scene.stop('UI');
            this.scene.start('Menu');
        });
    }
}
