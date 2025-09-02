import express from 'express';
import axios from 'axios';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect(['staff', 'admin', 'client']));

// Create payment intent
router.post('/intent', async (req, res) => {
  try {
    const { amount, method, description } = req.body;

    // Validate required fields
    if (!amount || !method) {
      return res.status(400).json({ msg: 'Amount and payment method are required' });
    }

    // For GCash payments
    if (method === 'gcash') {
      const response = await axios.post(
        'https://api.paymongo.com/v1/payment_intents',
        {
          data: {
            attributes: {
              amount: amount * 100, // Convert to cents
              payment_method_allowed: ['gcash'],
              currency: 'PHP',
              description
            }
          }
        },
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return res.json({
        intentId: response.data.data.id,
        clientKey: response.data.data.attributes.client_key
      });
    }

    res.status(400).json({ msg: 'Unsupported payment method' });
  } catch (err) {
    console.error('Payment intent error:', err.response?.data || err);
    res.status(500).json({ msg: 'Failed to create payment intent' });
  }
});

// Attach payment method to intent
router.post('/attach', async (req, res) => {
  try {
    const { intentId, method } = req.body;

    if (!intentId || !method) {
      return res.status(400).json({ msg: 'Intent ID and payment method are required' });
    }

    // For GCash payments
    if (method === 'gcash') {
      const response = await axios.post(
        'https://api.paymongo.com/v1/payment_intents/' + intentId + '/attach',
        {
          data: {
            attributes: {
              payment_method: method,
              return_url: process.env.FRONTEND_URL + '/payment/success?payment=success'
            }
          }
        },
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY).toString('base64')}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return res.json({
        status: response.data.data.attributes.status,
        redirectUrl: response.data.data.attributes.next_action?.redirect?.url
      });
    }

    res.status(400).json({ msg: 'Unsupported payment method' });
  } catch (err) {
    console.error('Payment attach error:', err.response?.data || err);
    res.status(500).json({ msg: 'Failed to attach payment method' });
  }
});

// Webhook for payment status updates
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;

    // Verify webhook signature
    // TODO: Implement webhook signature verification

    // Handle different event types
    switch (event.type) {
      case 'payment.paid':
        // Update reservation payment status
        // TODO: Implement reservation update
        break;
      case 'payment.failed':
        // Handle failed payment
        // TODO: Implement failed payment handling
        break;
      default:
        // Unhandled event type logged for monitoring
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(400).json({ msg: 'Webhook error' });
  }
});

export default router;
