require('dotenv').config();
const request = require('supertest');
const express = require('express');
const app = require('../app'); // Assurez-vous que `app.js` exporte votre instance d'Express

jest.mock('axios');  // Mock axios pour ne pas appeler un service réel
jest.mock('kafkajs');  // Mock Kafka

describe('Tests pour le service de réservation', () => {

  // Test pour récupérer toutes les réservations
  it('devrait récupérer toutes les réservations', async () => {
    // Simulation d'une réponse de la base de données
    const mockReservations = [
      { id: 1, user_id: 1, salle_id: 1, reservation_date: '2025-04-15T08:00:00Z', duration: 2 },
      { id: 2, user_id: 2, salle_id: 2, reservation_date: '2025-04-16T09:00:00Z', duration: 1 }
    ];
    jest.spyOn(pool, 'execute').mockResolvedValue([mockReservations]);

    const response = await request(app).get('/reservations');
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockReservations);
  });

  // Test pour créer une réservation
  it('devrait créer une réservation si la salle est disponible', async () => {
    const mockSalle = { id: 1, disponibilite: true };
    const mockInsertResult = { insertId: 1 };

    // Mock axios pour retourner la salle
    require('axios').get.mockResolvedValue({ data: mockSalle });

    // Mock de la requête d'insertion dans la base de données
    jest.spyOn(pool, 'execute').mockResolvedValue([mockInsertResult]);

    // Mock Kafka
    const producer = { send: jest.fn().mockResolvedValue(true) };
    jest.spyOn(producer, 'send').mockResolvedValue(true);

    const response = await request(app)
      .post('/reservations')
      .send({
        userId: 1,
        salleId: 1,
        startTime: '2025-04-15T08:00:00Z',
        endTime: '2025-04-15T10:00:00Z'
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Réservation effectuée avec succès');
    expect(response.body.reservationId).toBe(1);
  });

  // Test pour annuler une réservation
  it('devrait annuler une réservation', async () => {
    const reservationId = 1;
    const mockDeleteResult = { affectedRows: 1 };

    // Mock de la requête de suppression
    jest.spyOn(pool, 'execute').mockResolvedValue([mockDeleteResult]);

    // Mock Kafka
    const producer = { send: jest.fn().mockResolvedValue(true) };
    jest.spyOn(producer, 'send').mockResolvedValue(true);

    const response = await request(app).delete(`/reservations/${reservationId}`);
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Réservation annulée');
  });

  // Test pour la réservation d'une salle indisponible
  it('devrait échouer si la salle n\'est pas disponible', async () => {
    const mockSalleIndisponible = { id: 1, disponibilite: false };
    require('axios').get.mockResolvedValue({ data: mockSalleIndisponible });

    const response = await request(app)
      .post('/reservations')
      .send({
        userId: 1,
        salleId: 1,
        startTime: '2025-04-15T08:00:00Z',
        endTime: '2025-04-15T10:00:00Z'
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('La salle n\'est pas disponible pour la réservation');
  });
});
