class Bot {
    constructor(scene, x, y) {
        this.scene = scene;
        if (!scene.textures.exists('bot')) Bot._makeTexture(scene);

        this.sprite = scene.physics.add.sprite(x, y, 'bot').setDepth(5);
        this.sprite.body.setGravityY(C.GRAVITY);
        this.sprite.body.setCollideWorldBounds(true);
        this.sprite.body.setMaxVelocityX(320);

        this.hp    = 120;
        this.maxHp = 120;
        this.hitCd = 0;
        this.alive = true;

        // Pick a random weapon
        const wpnKeys = Object.keys(C.WEAPONS);
        this.weaponDef = C.WEAPONS[Phaser.Math.RND.pick(wpnKeys)];

        // AI state
        this.state       = 'patrol';
        this.patrolDir   = Phaser.Math.RND.pick([-1, 1]);
        this.patrolTimer = Phaser.Math.Between(1500, 4000);
        this.stateTimer  = 0;
        this.attackCd    = Phaser.Math.Between(400, 1200); // stagger spawns
        this.jumpCd      = 0;
        this.facing      = this.patrolDir;

        // ranges
        this.CHASE_RANGE   = 420;
        this.ATTACK_RANGE  = 52;
        this.RETREAT_RANGE = 480;

        // HP bar
        this.hpBg  = scene.add.rectangle(x, y - 22, 28, 4, 0x0a0404).setDepth(9);
        this.hpBar = scene.add.rectangle(x, y - 22, 28, 4, 0xcc1818).setDepth(10);

        // Weapon visuals
        this.weaponGfx    = scene.add.graphics().setDepth(7);
        this.swingTimer   = 0;
        this.swingDur     = this.weaponDef.atkDur;
        this.swingActive  = false;
    }

    static _makeTexture(scene) {
        const g = scene.make.graphics({ add: false });
        // Head - steel blue
        g.fillStyle(0x2c3f5a); g.fillRect(2, 0, 10, 7);
        // Eyes - red glow
        g.fillStyle(0xff3300); g.fillRect(4, 2, 2, 2);
        g.fillStyle(0xff3300); g.fillRect(8, 2, 2, 2);
        // Body
        g.fillStyle(0x1e2d40); g.fillRect(1, 7, 12, 9);
        // Chest detail
        g.fillStyle(0x263650); g.fillRect(3, 8, 8, 5);
        // Arms
        g.fillStyle(0x1e2d40); g.fillRect(-1, 8, 3, 6);
        g.fillStyle(0x1e2d40); g.fillRect(12, 8, 3, 6);
        // Legs
        g.fillStyle(0x162030); g.fillRect(1, 16, 4, 6);
        g.fillStyle(0x162030); g.fillRect(7, 16, 4, 6);
        g.generateTexture('bot', 14, 22); g.destroy();
    }

    update(delta, player, effects) {
        if (!this.alive) return;

        const body     = this.sprite.body;
        const onGround = body.blocked.down;
        const onWall   = body.blocked.left || body.blocked.right;

        // Timers
        if (this.hitCd     > 0) this.hitCd     -= delta;
        if (this.attackCd  > 0) this.attackCd  -= delta;
        if (this.stateTimer > 0) this.stateTimer -= delta;
        if (this.jumpCd    > 0) this.jumpCd    -= delta;
        if (this.swingTimer > 0) this.swingTimer -= delta;
        if (this.swingTimer <= 0) this.swingActive = false;

        const dx   = player.x - this.sprite.x;
        const dy   = player.y - this.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // ── State machine ──────────────────────────────────────────
        if (this.state !== 'stunned') {
            // Retreat: player is fast and close enough to be dangerous
            if (player.gauge > 70 && dist < this.RETREAT_RANGE && dist > 30) {
                this.state = 'retreat';
            }
            // Attack range — only if not currently retreating from a fast player
            else if (dist < this.ATTACK_RANGE) {
                if (this.state !== 'attacking') {
                    this.state      = 'attacking';
                    this.stateTimer = 600;
                }
            }
            // Chase
            else if (dist < this.CHASE_RANGE) {
                this.state = 'chase';
            }
            // Patrol
            else {
                this.state = 'patrol';
            }
        }

        // Stunned → patrol after recovery
        if (this.state === 'stunned' && this.stateTimer <= 0) {
            this.state = 'patrol';
        }
        // Attack phase ends
        if (this.state === 'attacking' && this.stateTimer <= 0) {
            this.state = 'chase';
        }

        // ── Movement ──────────────────────────────────────────────
        switch (this.state) {
            case 'patrol':   this._patrol(delta, body); break;
            case 'chase':    this._chase(dx, body);     break;
            case 'retreat':  this._retreat(dx, body);   break;
            case 'attacking':
                body.setAccelerationX(0);
                body.setDragX(1400);
                this._doAttack(player, effects);
                break;
            case 'stunned':
                body.setAccelerationX(0);
                body.setDragX(1200);
                break;
        }

        // ── Jumping ────────────────────────────────────────────────
        if (onGround && this.jumpCd <= 0) {
            // Chase player upward
            if (this.state === 'chase' && dy < -90) {
                body.setVelocityY(C.JUMP_VEL);
                this.jumpCd = 900;
            }
            // Wall-jump when stuck
            if (onWall && this.state !== 'patrol') {
                body.setVelocityY(C.JUMP_VEL * 0.85);
                this.jumpCd = 700;
            }
        }
        // Also jump mid-air if we somehow ended up against a wall not on ground
        if (!onGround && onWall && this.jumpCd <= 0 && this.state === 'chase') {
            body.setVelocityY(C.JUMP_VEL * 0.75);
            this.jumpCd = 900;
        }

        // ── Facing ───────────────────────────────────────────────
        if (body.velocity.x > 15)       this.facing =  1;
        else if (body.velocity.x < -15) this.facing = -1;
        this.sprite.setFlipX(this.facing === -1);

        // ── HP bar ───────────────────────────────────────────────
        const bx = this.sprite.x, by = this.sprite.y;
        this.hpBg.setPosition(bx, by - 22);
        const barW = Math.max(0, (this.hp / this.maxHp) * 28);
        this.hpBar.setPosition(bx - (28 - barW) / 2, by - 22).setSize(barW, 4);

        // ── Weapon draw ──────────────────────────────────────────
        this._drawWeapon();

        if (this.sprite.y > C.LAVA_Y) this.die();
    }

    // ── Movement methods ──────────────────────────────────────────

    _patrol(delta, body) {
        this.patrolTimer -= delta;
        if (this.patrolTimer <= 0 || body.blocked.left || body.blocked.right) {
            this.patrolDir   *= -1;
            this.patrolTimer  = Phaser.Math.Between(1500, 4000);
        }
        body.setAccelerationX(this.patrolDir * 500);
        body.setDragX(900);
        // Cap patrol speed
        if (Math.abs(body.velocity.x) > 90)
            body.setVelocityX(Phaser.Math.Linear(body.velocity.x, Math.sign(body.velocity.x) * 90, 0.12));
    }

    _chase(dx, body) {
        const dir = Math.sign(dx);
        body.setAccelerationX(dir * 1500);
        body.setDragX(350);
        if (Math.abs(body.velocity.x) > 190)
            body.setVelocityX(Phaser.Math.Linear(body.velocity.x, dir * 190, 0.09));
    }

    _retreat(dx, body) {
        const dir = -Math.sign(dx); // opposite of player
        body.setAccelerationX(dir * 1700);
        body.setDragX(350);
        if (Math.abs(body.velocity.x) > 210)
            body.setVelocityX(Phaser.Math.Linear(body.velocity.x, dir * 210, 0.1));
    }

    // ── Attack ────────────────────────────────────────────────────

    _doAttack(player, effects) {
        if (this.attackCd > 0) return;

        const dx   = player.x - this.sprite.x;
        const dy   = player.y - this.sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < this.ATTACK_RANGE + 20) {
            // Trigger swing visual
            this.swingActive = true;
            this.swingTimer  = this.weaponDef.atkDur;
            this.attackCd    = this.weaponDef.atkCd + 300;

            // Hit player: strong knockback + gauge drain (no HP loss — lava is the threat)
            const dir    = Math.sign(dx) !== 0 ? Math.sign(dx) : 1;
            const knockX = -dir * (360 + Math.random() * 120);
            const knockY = -(180 + Math.random() * 100);

            player.sprite.body.setVelocityX(knockX);
            player.sprite.body.setVelocityY(knockY);
            player.gauge = Math.max(0, player.gauge - 22);

            const dmg = Phaser.Math.Between(10, 20);
            effects.impactLines(player.x, player.y, dmg, this.weaponDef.glowCol);
            effects.shockwave(player.x, player.y, dmg, 0xffffff, this.weaponDef.glowCol);
            this.scene.cameras.main.shake(90, 0.007);
            this.scene.cameras.main.flash(50, 120, 0, 0, false);
            this.scene.events.emit('botHitPlayer', dmg);
        }
    }

    // ── Visuals ───────────────────────────────────────────────────

    _drawWeapon() {
        this.weaponGfx.clear();
        const px  = this.sprite.x, py = this.sprite.y;
        const wpn = this.weaponDef;

        if (this.swingActive) {
            const prog  = 1 - this.swingTimer / this.swingDur;
            const baseA = this.facing === 1 ? -1.8 : Math.PI + 1.8;
            const sweep = this.facing === 1 ? 3.6 : -3.6;
            const ang   = baseA + sweep * prog;
            const sw    = wpn.id === 'hammer' ? 5 : wpn.id === 'scythe' ? 4 : 2;
            this.weaponGfx.lineStyle(sw, wpn.swingCol, 0.9);
            this.weaponGfx.beginPath();
            this.weaponGfx.arc(px, py, wpn.radius * 0.8, baseA, ang, this.facing !== 1);
            this.weaponGfx.strokePath();
        } else {
            const idleA = this.facing === 1 ? 0.5 : Math.PI - 0.5;
            this.weaponGfx.lineStyle(wpn.id === 'hammer' ? 4 : 2, wpn.swingCol, 0.28);
            this.weaponGfx.lineBetween(
                px, py + 2,
                px + Math.cos(idleA) * 13 * this.facing,
                py + Math.sin(idleA) * 10
            );
        }
    }

    // ── Damage / Death ────────────────────────────────────────────

    takeDamage(dmg, knockX, knockY) {
        if (!this.alive || this.hitCd > 0) return false;
        this.hp    -= dmg;
        this.hitCd  = 160;
        this.sprite.body.setVelocity(knockX, knockY);
        this.sprite.setTint(0xffffff);
        this.state      = 'stunned';
        this.stateTimer = 220;
        this.scene.time.delayedCall(80, () => { if (this.alive) this.sprite.clearTint(); });
        if (this.hp <= 0) this.die();
        return true;
    }

    die() {
        if (!this.alive) return;
        this.alive = false;
        this.hpBg.destroy();
        this.hpBar.destroy();
        this.sprite.destroy();
        this.weaponGfx.destroy();
        this.scene.events.emit('botKilled', this);
    }

    get x()      { return this.sprite.x; }
    get y()      { return this.sprite.y; }
    get active() { return this.alive; }
}
