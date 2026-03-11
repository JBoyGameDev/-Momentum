class WaveManager {
    constructor(scene) {
        this.scene      = scene;
        this.wave       = 0;
        this.spawned    = 0;
        this.toSpawn    = 0;
        this.spawnTimer = 0;
        this.waveActive = false;
        this.waveCleared = false;
        this.betweenWaves = false;
        this.betweenTimer = 0;
    }

    startNextWave() {
        this.wave++;
        this.waveActive   = true;
        this.waveCleared  = false;
        this.betweenWaves = false;
        this.spawned      = 0;
        this.spawnTimer   = 800; // initial delay before first spawn

        const isBoss = this.wave % 5 === 0;
        this.toSpawn = isBoss ? 1 : 3 + (this.wave - 1) * 2;
        this.spawnQueue = isBoss ? this._buildBossWave() : this._buildWave();

        this.scene.events.emit('waveStarted', this.wave, isBoss);
    }

    _buildWave() {
        const queue = [];
        const speedMul = 1 + (this.wave - 1) * 0.1;
        const count    = this.toSpawn;

        for (let i = 0; i < count; i++) {
            let type;
            if (this.wave === 1)      type = 'grunt';
            else if (this.wave <= 3)  type = Math.random() < 0.7 ? 'grunt' : 'charger';
            else if (this.wave <= 6)  type = Phaser.Math.RND.pick(['grunt', 'grunt', 'charger', 'swarm']);
            else                       type = Phaser.Math.RND.pick(['grunt', 'charger', 'heavy', 'swarm', 'swarm']);

            const swarmBatch = type === 'swarm' ? 4 : 1;
            for (let s = 0; s < swarmBatch; s++) queue.push({ type, speedMul });
        }
        return queue;
    }

    _buildBossWave() {
        // Boss + some minions
        const queue = [{ type: 'boss', speedMul: 1 + (this.wave - 1) * 0.08 }];
        for (let i = 0; i < 4; i++) queue.push({ type: 'grunt', speedMul: 1.2 });
        this.toSpawn = queue.length;
        return queue;
    }

    update(delta, enemies) {
        if (!this.waveActive) return;

        // Check if wave is cleared
        if (this.spawned >= this.toSpawn && enemies.length === 0 && !this.waveCleared) {
            this.waveCleared  = true;
            this.betweenWaves = true;
            this.betweenTimer = 2800;
            this.scene.events.emit('waveCleared', this.wave);
        }

        if (this.betweenWaves) {
            this.betweenTimer -= delta;
            if (this.betweenTimer <= 0) this.startNextWave();
            return;
        }

        // Spawn next enemy in queue
        if (this.spawnQueue && this.spawnQueue.length > 0) {
            this.spawnTimer -= delta;
            if (this.spawnTimer <= 0) {
                const entry = this.spawnQueue.shift();
                this._spawnEnemy(entry.type, entry.speedMul);
                this.spawned++;

                // Stagger: boss gets longer gap, swarms get shorter
                const base = entry.type === 'boss' ? 400 : entry.type === 'swarm' ? 220 : 800;
                this.spawnTimer = base - Math.min(400, this.wave * 20);
            }
        }
    }

    _spawnEnemy(typeName, speedMul) {
        // Spawn just outside screen edge
        const side = Phaser.Math.Between(0, 3); // 0=left, 1=right, 2=top-left, 3=top-right
        let sx, sy;
        const margin = 60;
        if (side === 0) { sx = -margin;              sy = C.GROUND_Y - Phaser.Math.Between(0, 40); }
        else if (side === 1) { sx = C.WORLD_W + margin; sy = C.GROUND_Y - Phaser.Math.Between(0, 40); }
        else if (side === 2) { sx = Phaser.Math.Between(0, C.PLAYER_X - 100); sy = -margin; }
        else                  { sx = Phaser.Math.Between(C.PLAYER_X + 100, C.WORLD_W); sy = -margin; }

        const enemy = new Enemy(this.scene, sx, sy, typeName);
        // Apply speed modifier
        enemy.def = Object.assign({}, enemy.def, { spd: Math.round(enemy.def.spd * speedMul) });

        this.scene.events.emit('enemySpawned', enemy);
        return enemy;
    }
}
