  require('dotenv').config();
  const express = require('express');
  const mysql = require('mysql2/promise');
  const { Kafka } = require('kafkajs');
  const axios = require('axios');
  const cors = require('cors');
  const app = express();
  app.use(express.json());

  // Configuration MySQL
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'mysql',
    user: 'root',
    password: 'root',
    database: 'reservations_db'
  });

  app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true // permet l'envoi des cookies (sessions)
  }));
  
  // Configuration Kafka
  const kafka = new Kafka({
    clientId: 'reservation-service',
    brokers: [process.env.KAFKA_BROKER || 'kafka:9092']
  });

  const producer = kafka.producer();

  // Routes
  // Obtenir toutes les réservations
  app.get('/reservations', async (req, res) => {
    try {
      const [rows] = await pool.execute('SELECT * FROM reservations');
      res.status(200).json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erreur lors de la récupération des réservations' });
    }
  });


  // Réservation d'une salle
  app.post('/reservations', async (req, res) => {
    const { userId, salleId, startTime, endTime } = req.body;
  
    try {
      // Vérifier la disponibilité de la salle via salle-service
      const salleResponse = await axios.get(`http://salle-service:3002/salles/${salleId}`);
      const salle = salleResponse.data;
  
      // Vérifier si la salle existe et si elle est disponible
      if (!salle) {
        return res.status(404).json({ message: 'Salle non trouvée' });
      }
  
      // Vérifier si la salle est disponible
      if (!salle.disponibilite) {
        return res.status(400).json({ message: 'La salle n\'est pas disponible pour la réservation' });
      }
  
      // Créer la réservation dans la base de données
      const [result] = await pool.execute(
        'INSERT INTO reservations (user_id, salle_id, reservation_date, duration) VALUES (?, ?, ?, ?)',
        [userId, salleId, startTime, (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60)]  // Calcul de la durée en heures
      );
  
      // Envoyer un message à Kafka pour notifier la réservation
      await producer.send({
        topic: 'reservations',
        messages: [
          {
            value: JSON.stringify({
              userId,
              salleId,
              startTime,
              endTime,
              status: 'reserved'
            })
          }
        ]
      });
  
      // Si la salle est disponible, la réservation est effectuée et un message de succès est renvoyé
      res.status(201).json({ message: 'Réservation effectuée avec succès', reservationId: result.insertId });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erreur lors de la réservation' });
    }
  });
  
  

  // Annuler une réservation
  app.delete('/reservations/:reservationId', async (req, res) => {
    const { reservationId } = req.params;

    try {
      const [result] = await pool.execute('DELETE FROM reservations WHERE id = ?', [reservationId]);

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Réservation non trouvée' });
      }

      // Envoyer un message à Kafka pour notifier l'annulation de la réservation
      await producer.send({
        topic: 'reservations',
        messages: [
          {
            value: JSON.stringify({
              reservationId,
              status: 'cancelled'
            })
          }
        ]
      });

      res.status(200).json({ message: 'Réservation annulée' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Erreur lors de l\'annulation de la réservation' });
    }
  });

  /////////////////////
  // Obtenir une réservation par ID
  // Ajoute ceci à ton fichier principal (ex: app.js ou routes/reservation.js)

app.get('/reservations/user/:userId', async (req, res) => {
  const { userId } = req.params;

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM reservations WHERE user_id = ? ORDER BY reservation_date DESC',
      [userId]
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error('Erreur lors de la récupération des réservations :', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

  /////////////////////////
  // Modifier une réservation
app.put('/reservations/:reservationId', async (req, res) => {
  const { reservationId } = req.params;
  const { startTime, endTime } = req.body;  // Nouvelles données de réservation

  try {
    // Vérifier si la réservation existe
    const [existingReservation] = await pool.execute('SELECT * FROM reservations WHERE id = ?', [reservationId]);

    if (existingReservation.length === 0) {
      return res.status(404).json({ message: 'Réservation non trouvée' });
    }

    // Mettre à jour la réservation dans la base de données
    const [result] = await pool.execute(
      'UPDATE reservations SET reservation_date = ?, duration = ? WHERE id = ?',
      [startTime, (new Date(endTime) - new Date(startTime)) / (1000 * 60 * 60), reservationId]  // Calcul de la durée en heures
    );

    // Vérifier si la mise à jour a été effectuée
    if (result.affectedRows === 0) {
      return res.status(400).json({ message: 'Aucune mise à jour effectuée' });
    }

    // Envoyer un message à Kafka pour notifier la mise à jour
    await producer.send({
      topic: 'reservations',
      messages: [
        {
          value: JSON.stringify({
            reservationId,
            startTime,
            endTime,
            status: 'updated'
          })
        }
      ]
    });

    res.status(200).json({ message: 'Réservation mise à jour avec succès' });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la réservation :', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour de la réservation' });
  }
});



  // Démarrer le serveur et Kafka
  const startServer = async () => {
    await producer.connect();
    const PORT = process.env.PORT || 3003;
    app.listen(PORT, () => {
      console.log(`Reservation service running on port ${PORT}`);
    });
  };

  startServer();
