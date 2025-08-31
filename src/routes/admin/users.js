import express       from 'express';
import bcrypt        from 'bcryptjs';           // ← import bcrypt
import User          from '../../models/User.js';
import { protect }   from '../../middleware/auth.js';

const router = express.Router();

// allow both admin & staff
router.use(protect(['admin','staff']));

/**
 * GET /api/admin/users?role=staff
 */
router.get('/', async (req, res) => {
  try {
    const staff = await User.find({ role: 'staff' }).select('-password');
    res.json(staff);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * POST /api/admin/users
 * Create a new staff user (with hashed password)
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ msg: 'Name, email & password are required' });
    }
    if (await User.findOne({ email })) {
      return res.status(400).json({ msg: 'Email already in use' });
    }

    // **HASH the password before saving**
    const hashed = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashed,
      role
    });

    user.password = undefined;
    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update an existing staff user, hashing new password if provided
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.name  = name  ?? user.name;
    user.email = email ?? user.email;
    user.role  = role  ?? user.role;

    if (password) {
      // **HASH on update too**
      user.password = await bcrypt.hash(password, 12);
    }

    await user.save();
    user.password = undefined;
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

/**
 * DELETE /api/admin/users/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ msg: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;
