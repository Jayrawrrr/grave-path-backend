import express from 'express';
import Burial from '../../models/Burial.js';
import Interment from '../../models/Interments.js';
import Reservation from '../../models/Reservation.js';

const router = express.Router();

// Basic analytics function for local insights
function generateBasicInsights(burialsByMonth, totalIncome, reservationCount, intermentCount, burialCount) {
  const insights = [];
  
  if (burialsByMonth.length >= 2) {
    // Basic trend analysis
    const recent = burialsByMonth.slice(-3); // Look at last 3 months
    const currentMonth = recent[recent.length - 1];
    const previousMonth = recent[recent.length - 2];
    
    if (currentMonth && previousMonth) {
      const change = currentMonth.count - previousMonth.count;
      if (change > 0) {
        insights.push(`📈 Monthly increase of ${change} burials from previous month`);
      } else if (change < 0) {
        insights.push(`📉 Monthly decrease of ${Math.abs(change)} burials from previous month`);
      } else {
        insights.push(`📊 Stable activity with no change from previous month`);
      }
    }
  }
  
  // Basic revenue insights
  const avgRevenuePerReservation = reservationCount > 0 ? totalIncome / reservationCount : 0;
  if (avgRevenuePerReservation > 50000) {
    insights.push(`💰 Strong average revenue of ₱${Math.round(avgRevenuePerReservation).toLocaleString()} per reservation`);
  }
  
  // Service completion rate
  const serviceCompletionRate = burialCount > 0 ? (intermentCount / burialCount) * 100 : 0;
  if (serviceCompletionRate > 80) {
    insights.push(`✅ High service completion rate of ${serviceCompletionRate.toFixed(1)}%`);
  }
  
  // Booking pipeline
  if (reservationCount > burialCount) {
    const futurePipeline = reservationCount - burialCount;
    insights.push(`📋 ${futurePipeline} reservations in pipeline for future services`);
  }
  
  return insights;
}

router.get('/', async (_req, res) => {
  try {
    // Basic parallel data fetching
    const [burialCount, intermentCount, reservationCount] = await Promise.all([
      Burial.countDocuments(),
      Interment.countDocuments(),
      Reservation.countDocuments()
    ]);

    // Basic financial analysis
    const approvedReservations = await Reservation.find({ 
      $or: [
        { 'payment.status': 'paid' },
        { status: 'approved' },
        { paymentStatus: 'paid' },
        { 'payment.verified': true }
      ]
    });
    
    const totalIncome = approvedReservations.reduce((sum, r) => {
      const amount = r.payment?.amount || r.totalAmount || r.paymentAmount || r.amountPaid || r.price || 0;
      return sum + parseFloat(amount);
    }, 0);

    // Basic monthly analytics
    const [burialsByMonth, intermentsByMonth] = await Promise.all([
      Burial.aggregate([
        {
          $group: {
            _id: { year: { $year: '$burialDate' }, month: { $month: '$burialDate' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Interment.aggregate([
        {
          $group: {
            _id: { year: { $year: '$intermentDate' }, month: { $month: '$intermentDate' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ])
    ]);

    // Generate basic local insights
    const basicInsights = generateBasicInsights(
      burialsByMonth, totalIncome, reservationCount, intermentCount, burialCount
    );

    res.json({
      summary: {
        burials: burialCount,
        interments: intermentCount,
        reservations: reservationCount,
        totalIncome
      },
      burialsByMonth,
      intermentsByMonth,
      insights: basicInsights,
      meta: {
        lastUpdated: new Date().toISOString(),
        analysisType: 'basic-analytics'
      }
    });
  } catch (err) {
    console.error('Statistics error:', err);
    res.status(500).json({ msg: 'Failed to fetch statistics', error: err.message });
  }
});

// Basic health endpoint
router.get('/health', (_req, res) => {
  res.json({
    status: 'active',
    analysisType: 'basic-analytics',
    capabilities: [
      'Monthly Trends',
      'Revenue Analysis', 
      'Service Completion Tracking',
      'Reservation Pipeline'
    ],
    lastUpdated: new Date().toISOString()
  });
});

export default router;
