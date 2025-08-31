import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const sampleUsers = [
  // Admin Users
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'admin@gravepath.com',
    password: 'admin123',
    role: 'admin',
    emailVerified: true,
    profile: {
      phone: '(555) 123-4567',
      address: {
        street: '123 Memorial Drive',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62701',
        country: 'USA'
      },
      emergencyContact: {
        name: 'Michael Johnson',
        phone: '(555) 987-6543',
        relationship: 'Spouse'
      },
      preferences: {
        notifications: {
          email: true,
          sms: true
        },
        language: 'en',
        timezone: 'America/Chicago'
      }
    },
    adminData: {
      adminLevel: 'super',
      departments: ['Operations', 'Customer Service', 'Maintenance'],
      specialPermissions: ['user_management', 'system_config', 'financial_reports'],
      lastSystemAccess: new Date()
    }
  },
  {
    firstName: 'Robert',
    lastName: 'Chen',
    email: 'manager@gravepath.com',
    password: 'manager123',
    role: 'admin',
    emailVerified: true,
    profile: {
      phone: '(555) 234-5678',
      address: {
        street: '456 Oak Street',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62702',
        country: 'USA'
      },
      emergencyContact: {
        name: 'Lisa Chen',
        phone: '(555) 876-5432',
        relationship: 'Spouse'
      },
      preferences: {
        notifications: {
          email: true,
          sms: false
        },
        language: 'en',
        timezone: 'America/Chicago'
      }
    },
    adminData: {
      adminLevel: 'manager',
      departments: ['Customer Service'],
      specialPermissions: ['staff_management', 'reports'],
      lastSystemAccess: new Date()
    }
  },

  // Staff Users
  {
    firstName: 'Emily',
    lastName: 'Rodriguez',
    email: 'emily.staff@gravepath.com',
    password: 'staff123',
    role: 'staff',
    emailVerified: true,
    profile: {
      phone: '(555) 345-6789',
      address: {
        street: '789 Pine Avenue',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62703',
        country: 'USA'
      },
      emergencyContact: {
        name: 'Carlos Rodriguez',
        phone: '(555) 765-4321',
        relationship: 'Brother'
      },
      preferences: {
        notifications: {
          email: true,
          sms: true
        },
        language: 'en',
        timezone: 'America/Chicago'
      }
    },
    staffData: {
      employeeId: 'EMP001',
      department: 'Customer Service',
      position: 'Customer Service Representative',
      hireDate: new Date('2023-01-15'),
      permissions: ['view_reservations', 'create_reservations', 'update_visitor_info'],
      schedule: {
        workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        startTime: '08:00',
        endTime: '16:00'
      }
    }
  },
  {
    firstName: 'David',
    lastName: 'Thompson',
    email: 'david.staff@gravepath.com',
    password: 'staff123',
    role: 'staff',
    emailVerified: true,
    profile: {
      phone: '(555) 456-7890',
      address: {
        street: '321 Elm Street',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62704',
        country: 'USA'
      },
      emergencyContact: {
        name: 'Jennifer Thompson',
        phone: '(555) 654-3210',
        relationship: 'Wife'
      },
      preferences: {
        notifications: {
          email: true,
          sms: false
        },
        language: 'en',
        timezone: 'America/Chicago'
      }
    },
    staffData: {
      employeeId: 'EMP002',
      department: 'Maintenance',
      position: 'Groundskeeper',
      hireDate: new Date('2022-06-01'),
      permissions: ['view_lots', 'update_lot_status'],
      schedule: {
        workDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        startTime: '07:00',
        endTime: '15:00'
      }
    }
  },

  // Client Users
  {
    firstName: 'Maria',
    lastName: 'Garcia',
    email: 'maria.client@example.com',
    password: 'client123',
    role: 'client',
    emailVerified: true,
    profile: {
      phone: '(555) 567-8901',
      address: {
        street: '654 Maple Lane',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62705',
        country: 'USA'
      },
      emergencyContact: {
        name: 'Jose Garcia',
        phone: '(555) 543-2109',
        relationship: 'Husband'
      },
      preferences: {
        notifications: {
          email: true,
          sms: true
        },
        language: 'es',
        timezone: 'America/Chicago'
      }
    },
    clientData: {
      membershipType: 'premium',
      memberSince: new Date('2023-03-10'),
      totalReservations: 2,
      preferredPaymentMethod: 'Credit Card'
    }
  },
  {
    firstName: 'James',
    lastName: 'Wilson',
    email: 'james.client@example.com',
    password: 'client123',
    role: 'client',
    emailVerified: true,
    profile: {
      phone: '(555) 678-9012',
      address: {
        street: '987 Cedar Court',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62706',
        country: 'USA'
      },
      emergencyContact: {
        name: 'Susan Wilson',
        phone: '(555) 432-1098',
        relationship: 'Wife'
      },
      preferences: {
        notifications: {
          email: true,
          sms: false
        },
        language: 'en',
        timezone: 'America/Chicago'
      }
    },
    clientData: {
      membershipType: 'family',
      memberSince: new Date('2022-11-20'),
      totalReservations: 1,
      preferredPaymentMethod: 'Bank Transfer'
    }
  },
  {
    firstName: 'Linda',
    lastName: 'Brown',
    email: 'linda.client@example.com',
    password: 'client123',
    role: 'client',
    emailVerified: true,
    profile: {
      phone: '(555) 789-0123',
      address: {
        street: '147 Birch Street',
        city: 'Springfield',
        state: 'IL',
        zipCode: '62707',
        country: 'USA'
      },
      emergencyContact: {
        name: 'Robert Brown Jr.',
        phone: '(555) 321-0987',
        relationship: 'Son'
      },
      preferences: {
        notifications: {
          email: true,
          sms: false
        },
        language: 'en',
        timezone: 'America/Chicago'
      }
    },
    clientData: {
      membershipType: 'basic',
      memberSince: new Date('2024-01-05'),
      totalReservations: 0,
      preferredPaymentMethod: 'Credit Card'
    }
  }
];

async function seedUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing users (optional - remove this in production)
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Hash passwords and create users
    for (const userData of sampleUsers) {
      const salt = await bcrypt.genSalt(12);
      userData.password = await bcrypt.hash(userData.password, salt);
      
      const user = new User(userData);
      await user.save();
      console.log(`Created user: ${userData.firstName} ${userData.lastName} (${userData.role})`);
    }

    console.log('✅ Sample users created successfully!');
    console.log('\nLogin credentials:');
    console.log('Admin: admin@gravepath.com / admin123');
    console.log('Manager: manager@gravepath.com / manager123');
    console.log('Staff: emily.staff@gravepath.com / staff123');
    console.log('Staff: david.staff@gravepath.com / staff123');
    console.log('Client: maria.client@example.com / client123');
    console.log('Client: james.client@example.com / client123');
    console.log('Client: linda.client@example.com / client123');

  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seeder if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedUsers();
}

export default seedUsers; 