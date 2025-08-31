import mongoose from 'mongoose';

const IntermentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  plotId: { type: String, required: true },
  intermentDate: { type: Date, required: true },
  intermentTime: { type: String },
  officiant: { type: String },
  status: { type: String, default: 'scheduled' }
});

const Interment = mongoose.model('Interment', IntermentSchema);
export default Interment;
