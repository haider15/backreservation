require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const { Kafka } = require('kafkajs');
const cors = require('cors');
const app = express();
app.use(express.json());

  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true // permet l'envoi des cookies (sessions)
  }));

// Configuration MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mysql',
  user: 'root',
  password: 'root',
  database: 'salles_db'
});

// Configuration Kafka (optionnel)
const kafka = new Kafka({
  clientId: 'salle-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092']
});

// Routes
app.get('/salles', async (req, res) => {
  const [salles] = await pool.query('SELECT * FROM salles');
  res.json(salles);
});


app.get('/salles', async (req, res) => {
  const [salles] = await pool.query('SELECT * FROM salles');
  res.json(salles);
});

// Récupérer une salle spécifique par son ID
app.get('/salles/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [salle] = await pool.query('SELECT * FROM salles WHERE id = ?', [id]);

    if (salle.length === 0) {
      return res.status(404).json({ message: 'Salle non trouvée 1' });
    }

    res.json(salle[0]); // Retourne la salle trouvée
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la récupération de la salle' });
  }
});



// Ajouter une nouvelle salle
app.post('/salles', async (req, res) => {
  const { nom, capacite, equipements } = req.body;

  try {
    const [result] = await pool.query(
      'INSERT INTO salles (nom, capacite, equipements) VALUES (?, ?, ?)',
      [nom, capacite, JSON.stringify(equipements)]
    );
    res.status(201).json({
      id: result.insertId,
      nom,
      capacite,
      equipements,
      disponibilite: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de l\'ajout de la salle', error: error.message });
  }
});


// Modifier une salle existante
app.put('/salles/:id', async (req, res) => {
  const { id } = req.params;
  const { nom, capacite, equipements } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE salles SET nom = ?, capacite = ?, equipements = ?, updated_at = ? WHERE id = ?',
      [nom, capacite, JSON.stringify(equipements), new Date(), id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Salle non trouvée 2' });
    }

    res.json({
      id,
      nom,
      capacite,
      equipements,
      disponibilite: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la salle', error: error.message });
  }
});

// Supprimer une salle
app.delete('/salles/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query('DELETE FROM salles WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Salle non trouvée 3' });
    }

    res.json({ message: 'Salle supprimée avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la suppression de la salle', error: error.message });
  }
});

app.put('/salles/:id/disponibilite', async (req, res) => {
  const { id } = req.params;
  const { disponibilite } = req.body; // { "disponibilite": true } ou { "disponibilite": false }

  // Vérification si la valeur de disponibilite est valide
  if (typeof disponibilite !== 'boolean') {
    return res.status(400).json({ message: 'La disponibilité doit être un booléen' });
  }

  try {
    const [result] = await pool.query(
      'UPDATE salles SET disponibilite = ?, updated_at = ? WHERE id = ?',
      [disponibilite, new Date(), id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Salle non  4 ' });
    }

    res.json({ message: 'Disponibilité mise à jour avec succès' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la disponibilité', error: error.message });
  }
});

// Afficher toutes les salles disponibles
app.get('/sal/disponibles', async (req, res) => {
  try {
    // Récupérer toutes les salles disponibles (disponibilite = 1)
    const [sallesDisponibles] = await pool.query('SELECT * FROM salles WHERE disponibilite = 1');
    
    if (sallesDisponibles.length === 0) {
      return res.status(404).json({ message: 'Aucune salle disponible' });
    }

    res.json(sallesDisponibles); // Retourne les salles disponibles
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur lors de la récupération des salles disponibles' });
  }
});



// Démarrer le serveur
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Salle service on ${PORT}`));