import mongoose from "mongoose";

const locationPointSchema = new mongoose.Schema(
    {
        latitude: {
            type: Number,
            required: true
        },

        longitude: {
            type: Number,
            required: true
        },

        accuracy: {
            type: Number,
            default: null
        },

        timestamp: {
            type: Date,
            required: true
        }
    },
    {
        _id: false
    }
);


const routeSchema = new mongoose.Schema(
    {
        routeId: {
            type: String,
            required: true
        },

        startTime: {
            type: Date,
            required: true
        },

        endTime: {
            type: Date,
            default: null
        },

        startLocation: {
            latitude: {
                type: Number,
                required: true
            },

            longitude: {
                type: Number,
                required: true
            }
        },

        endLocation: {
            latitude: {
                type: Number,
                default: null
            },

            longitude: {
                type: Number,
                default: null
            }
        },

        distance: {
            type: Number,
            default: 0
        },

        duration: {
            type: Number,
            default: 0
        },

        points: {
            type: [locationPointSchema],
            default: []
        }
    },
    {
        _id: false
    }
);


const dailyHistorySchema = new mongoose.Schema(
    {
        date: {
            type: String,
            required: true,
            unique: true
        },

        totalDistance: {
            type: Number,
            default: 0
        },

        totalTravelTime: {
            type: Number,
            default: 0
        },

        routes: {
            type: [routeSchema],
            default: []
        }
    },

    {
        timestamps: true
    }
);


export default mongoose.model(
    "DailyHistory",
    dailyHistorySchema
);