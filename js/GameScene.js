class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    init(data) { this.weaponId = data.weaponId || 'sword'; }

    create() {
        this.physics.world.setBounds(0, 0, C.WORLD_W, C.WORLD_H);
        this.cameras.main.setBounds(0, 0, C.WORLD_W, C.WORLD_H);
        this.cameras.main.setZoom(C.ZOOM_CLOSE);

        this.floors    = this.physics.add.staticGroup();
        this.walls     = this.physics.add.staticGroup();
        this.effects   = new Effects(this);
        this.platforms = MapBuilder.build(this, this.floors, this.walls);

        this.player = new Player(this, 120, 700, this.weaponId);
        this.physics.add.collider(this.player.sprite, this.floors);
        this.physics.add.collider(this.player.sprite, this.walls);

        this.enemies = [];
        this._spawnInitialBots();

        this.keys = this.input.keyboard.addKeys({
            left:  Phaser.Input.Keyboard.KeyCodes.LEFT,
            right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
            up:    Phaser.Input.Keyboard.KeyCodes.UP,
            down:  Phaser.Input.Keyboard.KeyCodes.DOWN,
            z:     Phaser.Input.Keyboard.KeyCodes.Z,
            x:     Phaser.Input.Keyboard.KeyCodes.X,
        });

        this.events.on('botKilled',    (b)   => this._onBotKilled(b));
        this.events.on('playerDied',   ()    => this._onPlayerDied());
        this.events.on('playerHit',    (dmg) => this._onPlayerHit(dmg));
        this.events.on('botHitPlayer', (dmg) => this._onBotHitPlayer(dmg));

        this.cameras.main.startFollow(this.player.sprite, true, 0.07, 0.07);
        this.targetZoom = C.ZOOM_CLOSE;
        this.scene.launch('UI', { gameScene: this });
        this.cameras.main.fadeIn(400);

        this.hitStopActive = false;
        this.hitStopTimer  = 0;
    }

    update(time, delta) {
        if (this.hitStopActive) {
            this.hitStopTimer -= delta;
            if (this.hitStopTimer <= 0) this.hitStopActive = false;
            this.effects.update(delta);
            return;
        }

        if (!this.player.dead) {
            this.player.update(delta, this.keys, this.enemies, this.effects);
        }

        for (let i = 0; i < this.enemies.length; i++) {
            if (this.enemies[i].alive)
                this.enemies[i].update(delta, this.player, this.effects);
        }
        this.enemies = this.enemies.filter(e => e.alive);

        this.effects.update(delta);
        this._updateZoom();
    }

    _updateZoom() {
        const py = this.player.y;
        let minDist = Infinity;
        for (let i = 0; i < this.platforms.length; i++) {
            const dist = Math.abs(py - this.platforms[i].y);
            if (dist < minDist) minDist = dist;
        }
        const zoom = minDist < C.ZOOM_NEAR_DIST ? C.ZOOM_CLOSE
                   : minDist < C.ZOOM_FAR_DIST  ? C.ZOOM_MID
                   : C.ZOOM_FAR;
        this.targetZoom = Phaser.Math.Linear(this.targetZoom, zoom, 0.035);
        this.cameras.main.setZoom(this.targetZoom);
    }

    _spawnInitialBots() {
        [
            [380, 720], [720, 720], [1100, 720], [1500, 720], [1850, 720],
            [550, 540], [950, 460], [1300, 540], [820, 300],
        ].forEach(([x, y]) => this._spawnBot(x, y));
    }

    _spawnBot(x, y) {
        const bot = new Bot(this, x, y);
        this.physics.add.collider(bot.sprite, this.floors);
        this.physics.add.collider(bot.sprite, this.walls);
        this.enemies.push(bot);
    }

    // Only shake + flash if kill is visible on screen
    _onBotKilled(bot) {
        this.player.kills++;

        const cam    = this.cameras.main;
        const onScreen = (
            bot.x > cam.scrollX - 80 &&
            bot.x < cam.scrollX + cam.width + 80 &&
            bot.y > cam.scrollY - 80 &&
            bot.y < cam.scrollY + cam.height + 80
        );

        this.effects.killBlood(bot.x, bot.y);

        if (onScreen) {
            cam.flash(80, 255, 0, 0, false);
            cam.shake(160, 0.011);

            const cx = cam.scrollX + cam.width  / 2;
            const cy = cam.scrollY + cam.height * 0.3;
            const kt = this.add.text(cx, cy, 'ELIMINATED', {
                fontSize: '14px', color: '#ff0000', stroke: '#000',
                strokeThickness: 5, fontFamily: 'monospace', letterSpacing: 6,
            }).setDepth(20).setOrigin(0.5).setScale(0.3);
            this.tweens.add({
                targets: kt, scaleX: 1.4, scaleY: 1.4, y: kt.y - 30, alpha: 0,
                duration: 1100, ease: 'Back.Out', onComplete: () => kt.destroy(),
            });
        }

        this.time.delayedCall(2200, () => {
            if (this.scene.isActive('Game'))
                this._spawnBot(Phaser.Math.Between(150, C.WORLD_W - 150), 80);
        });

        this.events.emit('killsUpdated', this.player.kills);
    }

    _onPlayerDied() {
        // Dramatic death — red flash, freeze, then fade to respawn
        this.cameras.main.flash(300, 255, 0, 0, false);
        this.cameras.main.shake(250, 0.02);

        const cam = this.cameras.main;
        const cx  = cam.scrollX + cam.width  / 2;
        const cy  = cam.scrollY + cam.height / 2;
        const dt  = this.add.text(cx, cy, 'YOU DIED', {
            fontSize: '22px', color: '#ff0000', stroke: '#000',
            strokeThickness: 6, fontFamily: 'monospace', letterSpacing: 8,
        }).setDepth(30).setOrigin(0.5).setScale(0.5).setAlpha(0);
        this.tweens.add({
            targets: dt, scaleX: 1.3, scaleY: 1.3, alpha: 1,
            duration: 500, ease: 'Back.Out',
        });

        this.time.delayedCall(1200, () => {
            this.tweens.add({
                targets: dt, alpha: 0, duration: 300,
                onComplete: () => { dt.destroy(); this._respawnPlayer(); }
            });
        });
    }

    _onPlayerHit(dmg) {
        this.hitStopActive = true;
        this.hitStopTimer  = C.HIT_STOP_MS * (0.5 + (dmg / 40) * 0.5);
        this.events.emit('hitDmg', dmg);
    }

    _onBotHitPlayer(dmg) {
        this.hitStopActive = true;
        this.hitStopTimer  = 55;
    }

    _respawnPlayer() {
        this.cameras.main.fadeIn(300);
        this.player.sprite.setPosition(120, 700);
        this.player.sprite.body.setVelocity(0, 0);
        this.player.gauge = 0;
        this.player.dead  = false;
    }
}