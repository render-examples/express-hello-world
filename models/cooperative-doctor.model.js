const mongoose = require("mongoose");
const opts = { toJSON: { virtuals: true } };

const cooperativeDoctorSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    firstname: String,
    lastname: String,
    consulting: Boolean,
    notes: String,
    specialty: String,
    primaryFacilityId: String,
    phoneNumbers: Array,
}, opts);

cooperativeDoctorSchema.virtual('id').get(function() {
    return this._id.toString();
})

cooperativeDoctorSchema.virtual('fullname').get(function() {
    return this.firstname + " " + this.lastname;
})

cooperativeDoctorSchema.virtual('primaryPhone').get(function() {
    return this.phoneNumbers[0];
})

cooperativeDoctorSchema.virtual('primaryFacility', {
    ref: 'Hospital',
    localField: 'primaryFacilityId',
    foreignField: '_id',
    justOne: true
});

module.exports = mongoose.model("CooperativeDoctor", cooperativeDoctorSchema, "cooperativeDoctors");