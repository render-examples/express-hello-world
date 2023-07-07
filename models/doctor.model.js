const mongoose = require("mongoose");
const opts = { toJSON: { virtuals: true } };

const doctorSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    firstname: String,
    lastname: String,
    specialty: String,
    primaryFacilityId: String,
    phone: String,
    isCooperative: Boolean
}, opts);

doctorSchema.virtual('id').get(function() {
    return this._id.toString();
})

doctorSchema.virtual('fullname').get(function() {
    return this.firstname + " " + this.lastname;
})

doctorSchema.virtual('primaryFacility', {
    ref: 'Hospital',
    localField: 'primaryFacilityId',
    foreignField: '_id',
    justOne: true
});

module.exports = mongoose.model("Doctor", doctorSchema);