import mongoose from 'mongoose';

const BurialSchema = new mongoose.Schema({
  name: { type: String, required: true },
  burialDate: { type: Date, required: true },
  plotId: { type: String, required: true },
  deathCertificateUrl: { type: String }
});

const Burial = mongoose.model('Burial', BurialSchema);
export default Burial;
