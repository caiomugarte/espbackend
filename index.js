const express = require("express");
const bodyParser = require("body-parser");
const Redis = require("ioredis");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 3000;

// Configurar Redis
const redis = new Redis(); // Redis rodando localmente

const RSSI_THRESHOLD = -40; // Limiar de RSSI

app.use(bodyParser.json());
app.use(cors());

// Endpoint para receber dados da ESP
app.post("/bluetooth-data", async (req, res) => {
    const { mac, rssi } = req.body;

    console.log("Dados recebidos da ESP:", req.body);

    // Verifica se o RSSI está dentro do limiar
    if (rssi <= RSSI_THRESHOLD) {
        console.log(`Dispositivo ${mac} ignorado, RSSI ${rssi} acima do limiar.`);
        try{
            const redisKey = `bluetooth:${mac}`
            await redis.del(redisKey);
            console.log(`Informações para o dispositivo ${mac} excluídas com sucesso`)
        } catch (err) {
            console.log("Ocorreu um erro para limpar o redis", err);
        }
        return res.status(200).send({ message: "RSSI acima do limiar. Dado ignorado." });
    }

    try {
        // Salvar no Redis
        const redisKey = `bluetooth:${mac}`;
        const data = { mac, rssi, timestamp: new Date().toISOString() };

        await redis.set(redisKey, JSON.stringify(data));
        await redis.expire(redisKey, 60 * 5); // Expirar em 5 minutos (opcional)

        console.log(`Dispositivo ${mac} salvo no Redis:`, data);
        res.status(200).send({ message: "Dados recebidos e salvos com sucesso!" });
    } catch (err) {
        console.error("Erro ao salvar no Redis:", err);
        res.status(500).send({ error: "Erro ao processar os dados." });
    }
});

// Endpoint para consultar dispositivos próximos
app.get("/nearby-devices", async (req, res) => {
    try {
        // Buscar todas as chaves de dispositivos no Redis
        const keys = await redis.keys("bluetooth:*");

        const devices = [];
        for (const key of keys) {
            const device = await redis.get(key);
            devices.push(JSON.parse(device));
        }

        res.status(200).send(devices);
    } catch (err) {
        console.error("Erro ao buscar dispositivos no Redis:", err);
        res.status(500).send({ error: "Erro ao buscar dispositivos." });
    }
});

app.listen(port, () => {
    console.log(`Server running on port: ${port}`);
});
