class Bot {
    constructor(scene, x, y) {
        this.scene = scene;
        if (!scene.textures.exists('bot')) Bot._makeTexture(scene);

        this.sprite = scene.physics.add.sprite(x, y, 'bot').setDepth(5);
        this.sprite.body.setGravityY(C.GRAVITY);
        this.sprite.body.setCollideWorldBounds(true);
        this.sprite.body.setMaxVelocityX(280);

        this.hp    = 120;
        this.maxHp = 120;
        this.hitCd = 0;
        this.alive = true;

        // Random weapon
        const wpnKeys  = Object.keys(C.WEAPONS);
        this.weaponDef = C.WEAPONS[Phaser.Math.RND.pick(wpnKeys)];

        // Home position — bots patrol near where they spawned
        this.homeX      = x;
        this.patrolDir  = Phaser.Math.RND.pick([-1, 1]);
        this.patrolTimer = Phaser.Math.Between(1200, 3000);

        // AI state
        this.state      = 'patrol';
        this.stateTimer = 0;
        this.attackCd   = Phaser.Math.Between(600, 1400); // staggered spawn
        this.jumpCd     = 0;
        this.facing     = this.patrolDir;

        // Tuned ranges — smaller so bots don't chase across the whole map
        this.AGGRO_RANGE   = 260;   // only chase if player gets this close
        this.ATTACK_RANGE  = 48;
        this.RETREAT_GAUGE = 75;    // gauge threshold to fear player
        this.PATROL_RADIUS = 80;    // won't wander more than this from home

        // Weapon visuals
        this.weaponGfx   = scene.add.graphics().setDepth(7);
        this.swingTimer  = 0;
        this.swingDur    = this.weaponDef.atkDur;
        this.swingActive = false;

        // HP bar
        this.hpBg  = scene.add.rectangle(x, y - 22, 28, 4, 0x0a0404).setDepth(9);
        this.hpBar = scene.add.rectangle(x, y - 22, 28, 4, 0xcc1818).setDepth(10);
    }

    // Chunky Doom demon: brown/red, hunched, glowing eyes
    static _makeTexture(scene) {
        const g = scene.make.graphics({ add: false });
        // Body - wide brown-red
        g.fillStyle(0x7a2a14); g.fillRect(0, 6, 16, 10);
        // Chest highlight
        g.fillStyle(0x9a3a1a); g.fillRect(2, 7, 12, 5);
        // Head - large, pushed forward
        g.fillStyle(0x8a3018); g.fillRect(2, 0, 12, 8);
        // Eyes - bright orange-red glow
        g.fillStyle(0xff4400); g.fillRect(3, 2, 3, 3);
        g.fillStyle(0xff4400); g.fillRect(10, 2, 3, 3);
        // Eye shine
        g.fillStyle(0xff8800); g.fillRect(4, 2, 1, 1);
        g.fillStyle(0xff8800); g.fillRect(11, 2, 1, 1);
        // Mouth - grimace
        g.fillStyle(0x330808); g.fillRect(5, 5, 6, 2);
        g.fillStyle(0xff2200); g.fillRect(6, 5, 1, 2);
        g.fillStyle(0xff2200); g.fillRect(9, 5, 1, 2);
        // Arms - wide
        g.fillStyle(0x6a2010); g.fillRect(-2, 8, 4, 6);
        g.fillStyle(0x6a2010); g.fillRect(14, 8, 4, 6);
        // Legs - short and thick
        g.fillStyle(0x4a1808); g.fillRect(1, 16, 5, 6);
        g.fillStyle(0x4a1808); g.fillRect(10, 16, 5, 6);
        g.generateTexture('bot', 18, 22); g.destroy();
    }

    update(delta, player, effects) {
        if (!this.alive) return;

        const body     = this.sprite.body;
        const onGround = body.blocked.down;
        const onWall   = body.blocked.left || body.blocked.right;

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
            const playerFast = player.gauge > this.RETREAT_GAUGE;
            const inAggro    = dist < this.AGGRO_RANGE;

            if (playerFast && inAggro && dist > 30) {
                // Fear fast player — back off
                this.state = 'retreat';
            } else if (dist < this.ATTACK_RANGE && inAggro) {
                if (this.state !== 'attacking') {
                    this.state      = 'attacking';
                    this.stateTimer = 500;
                }
            } else if (inAggro) {
                this.state = 'chase';
            } else {
                // Out of aggro range — return to patrol near home
                this.state = 'patrol';
            }
        }

        if (this.state === 'stunned' && this.stateTimer <= 0) this.state = 'patrol';
        if (this.state === 'attacking' && this.stateTimer <= 0) this.state = 'chase';

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
            if (this.state === 'chase' && dy < -80) {
                body.setVelocityY(C.JUMP_VEL);
                this.jumpCd = 900;
            }
        }
        if (onWall && this.jumpCd <= 0 && (this.state === 'chase' || this.state === 'retreat')) {
            body.setVelocityY(C.JUMP_VEL * 0.8);
            this.jumpCd = 700;
        }

        // ── Facing ──────────────────────────────────────────────
        if (body.velocity.x > 15)       this.facing =  1;
        else if (body.velocity.x < -15) this.facing = -1;
        this.sprite.setFlipX(this.facing === -1);

        // ── HP bar ──────────────────────────────────────────────
        const bx = this.sprite.x, by = this.sprite.y;
        this.hpBg.setPosition(bx, by - 22);
        const barW = Math.max(0, (this.hp / this.maxHp) * 28);
        this.hpBar.setPosition(bx - (28 - barW) / 2, by - 22).setSize(barW, 4);

        // ── Weapon draw ─────────────────────────────────────────
        this._drawWeapon();

        if (this.sprite.y > C.LAVA_Y) this.die();
    }

    _patrol(delta, body) {
        this.patrolTimer -= delta;
        // Reverse at home boundary or wall
        const distFromHome = this.sprite.x - this.homeX;
        const hitBoundary  = Math.abs(distFromHome) > this.PATROL_RADIUS;
        if (this.patrolTimer <= 0 || body.blocked.left || body.blocked.right || hitBoundary) {
            this.patrolDir   *= -1;
            this.patrolTimer  = Phaser.Math.Between(1200, 3000);
        }
        body.setAccelerationX(this.patrolDir * 400);
        body.setDragX(800);
        if (Math.abs(body.velocity.x) > 75)
            body.setVelocityX(Phaser.Math.Linear(body.velocity.x, Math.sign(body.velocity.x) * 75, 0.12));
    }

    _chase(dx, body) {
        const dir = Math.sign(dx);
        body.setAccelerationX(dir * 1400);
        body.setDragX(300);
        if (Math.abs(body.velocity.x) > 180)
            body.setVelocityX(Phaser.Math.Linear(body.velocity.x, dir * 180, 0.09));
    }

    _retreat(dx, body) {
        const dir = -Math.sign(dx);
        body.setAccelerationX(dir * 1600);
        body.setDragX(300);
        if (Math.abs(body.velocity.x) > 200)
            body.setVelocityX(Phaser.Math.Linear(body.velocity.x, dir * 200, 0.1));
    }

    _doAttack(player, effects) {
        if (this.attackCd > 0) return;
        const dx   = player.x - this.sprite.x;
        const dist = Math.abs(dx);
        if (dist < this.ATTACK_RANGE + 20) {
            this.swingActive = true;
            this.swingTimer  = this.weaponDef.atkDur;
            this.attackCd    = this.weaponDef.atkCd + 400;

            const dir    = Math.sign(dx) || 1;
            const knockX = -dir * (340 + Math.random() * 120);
            const knockY = -(160 + Math.random() * 100);
            player.sprite.body.setVelocityX(knockX);
            player.sprite.body.setVelocityY(knockY);
            player.gauge = Math.max(0, player.gauge - 22);

            const dmg = Phaser.Math.Between(8, 18);
            effects.impactLines(player.x, player.y, dmg, this.weaponDef.glowCol);
            effects.shockwave(player.x, player.y, dmg, 0xffffff, this.weaponDef.glowCol);
            this.scene.events.emit('botHitPlayer', dmg);
        }
    }

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
            this.weaponGfx.lineBetween(px, py + 2, px + Math.cos(idleA) * 13 * this.facing, py + Math.sin(idleA) * 10);
        }
    }

    takeDamage(dmg, knockX, knockY) {
        if (!this.alive || this.hitCd > 0) return false;
        this.hp    -= dmg;
        this.hitCd  = 160;
        this.sprite.body.setVelocity(knockX, knockY);

        // Flash white then return to normal tint
        this.sprite.setTint(0xffffff);
        this.scene.time.delayedCall(80, () => {
            if (this.alive) this.sprite.clearTint();
        });

        this.state      = 'stunned';
        this.stateTimer = 220;
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