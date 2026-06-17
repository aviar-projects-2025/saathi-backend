import mongoose from 'mongoose'

const rideSchema = new mongoose.Schema({
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    from: {
        type: String,
        required: true
    },

    destination: {
        type: String,
        required: true
    },

    startTime: {
        type: Date,
        required: true
    },

    modeOfTravel: {
        type: String,
        enum: ['Car', 'Bus', 'Bike', 'Flight', 'Ship', 'Train'],
        required: true
    },

    availableSeats: {
        type: Number,
        required: true
    },

    fuelSharing: {
        type: Boolean,
        default: false
    },

    description: {
        type: String
    },

    status: {
        type: String,
        enum: ['OPEN', 'FULL', 'CLOSED'],
        default: 'OPEN'
    },
    genderPreference: {
        type: String,
        enum: ['Male', 'Female', 'Any'],
        default: 'Any'
    }

}, {
    timestamps: true
})

const Ride = mongoose.model('Ride', rideSchema)

export default Ride