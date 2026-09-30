import mongoose from "mongoose";
import dotenv from "dotenv";
import DailyHistory from "./schemas/DailyHistory.js";

dotenv.config();

const dummyHistory = {
    date: "2026-09-26",

    totalDistance: 15.2,

    totalTravelTime: 72,

    routes: [

        // ==========================================
        // ROUTE 1
        // THANE RAILWAY STATION → MULUND RAILWAY STATION
        // ==========================================

        {
            routeId: "thane_to_mulund",

            startTime: new Date(
                "2026-09-26T08:15:00+05:30"
            ),

            endTime: new Date(
                "2026-09-26T08:48:00+05:30"
            ),

            startLocation: {
                latitude: 19.1860,
                longitude: 72.9758
            },

            endLocation: {
                latitude: 19.1726,
                longitude: 72.9562
            },

            distance: 8.4,

            duration: 33,

            points: [

                {
                    latitude: 19.1860,
                    longitude: 72.9758,
                    accuracy: 7,
                    timestamp: new Date(
                        "2026-09-26T08:15:00+05:30"
                    )
                },

                {
                    latitude: 19.1848,
                    longitude: 72.9738,
                    accuracy: 8,
                    timestamp: new Date(
                        "2026-09-26T08:18:00+05:30"
                    )
                },

                {
                    latitude: 19.1831,
                    longitude: 72.9708,
                    accuracy: 6,
                    timestamp: new Date(
                        "2026-09-26T08:21:00+05:30"
                    )
                },

                {
                    latitude: 19.1810,
                    longitude: 72.9680,
                    accuracy: 7,
                    timestamp: new Date(
                        "2026-09-26T08:24:00+05:30"
                    )
                },

                {
                    latitude: 19.1787,
                    longitude: 72.9650,
                    accuracy: 9,
                    timestamp: new Date(
                        "2026-09-26T08:26:00+05:30"
                    )
                },

                {
                    latitude: 19.1763,
                    longitude: 72.9620,
                    accuracy: 7,
                    timestamp: new Date(
                        "2026-09-26T08:30:00+05:30"
                    )
                },

                {
                    latitude: 19.1748,
                    longitude: 72.9592,
                    accuracy: 8,
                    timestamp: new Date(
                        "2026-09-26T08:34:00+05:30"
                    )
                },

                {
                    latitude: 19.1737,
                    longitude: 72.9575,
                    accuracy: 6,
                    timestamp: new Date(
                        "2026-09-26T08:38:00+05:30"
                    )
                },

                {
                    latitude: 19.1726,
                    longitude: 72.9562,
                    accuracy: 7,
                    timestamp: new Date(
                        "2026-09-26T08:48:00+05:30"
                    )
                }
            ]
        },


        // ==========================================
        // ROUTE 2
        // MULUND → THANE
        // ==========================================

        {
            routeId: "mulund_to_thane",

            startTime: new Date(
                "2026-09-26T13:20:00+05:30"
            ),

            endTime: new Date(
                "2026-09-26T13:55:00+05:30"
            ),

            startLocation: {
                latitude: 19.1726,
                longitude: 72.9562
            },

            endLocation: {
                latitude: 19.1860,
                longitude: 72.9758
            },

            distance: 8.1,

            duration: 35,

            points: [

                {
                    latitude: 19.1726,
                    longitude: 72.9562,
                    accuracy: 7,
                    timestamp: new Date(
                        "2026-09-26T13:20:00+05:30"
                    )
                },

                {
                    latitude: 19.1738,
                    longitude: 72.9580,
                    accuracy: 8,
                    timestamp: new Date(
                        "2026-09-26T13:24:00+05:30"
                    )
                },

                {
                    latitude: 19.1750,
                    longitude: 72.9602,
                    accuracy: 6,
                    timestamp: new Date(
                        "2026-09-26T13:28:00+05:30"
                    )
                },

                {
                    latitude: 19.1768,
                    longitude: 72.9630,
                    accuracy: 7,
                    timestamp: new Date(
                        "2026-09-26T13:32:00+05:30"
                    )
                },

                {
                    latitude: 19.1790,
                    longitude: 72.9658,
                    accuracy: 8,
                    timestamp: new Date(
                        "2026-09-26T13:36:00+05:30"
                    )
                },

                {
                    latitude: 19.1812,
                    longitude: 72.9688,
                    accuracy: 7,
                    timestamp: new Date(
                        "2026-09-26T13:40:00+05:30"
                    )
                },

                {
                    latitude: 19.1833,
                    longitude: 72.9715,
                    accuracy: 9,
                    timestamp: new Date(
                        "2026-09-26T13:44:00+05:30"
                    )
                },

                {
                    latitude: 19.1850,
                    longitude: 72.9740,
                    accuracy: 7,
                    timestamp: new Date(
                        "2026-09-26T13:49:00+05:30"
                    )
                },

                {
                    latitude: 19.1860,
                    longitude: 72.9758,
                    accuracy: 6,
                    timestamp: new Date(
                        "2026-09-26T13:55:00+05:30"
                    )
                }
            ]
        }
    ]
};


async function seedDatabase() {

    try {

        await mongoose.connect(
            process.env.MONGO_URI
        );

        console.log(
            "✅ MongoDB Connected"
        );


        // Remove existing dummy day

        await DailyHistory.deleteOne({
            date: dummyHistory.date
        });


        // Insert new history

        const history =
            await DailyHistory.create(
                dummyHistory
            );


        console.log(
            "✅ Dummy history inserted"
        );

        console.log(
            `Date: ${history.date}`
        );

        console.log(
            `Routes: ${history.routes.length}`
        );

        console.log(
            `Total distance: ${history.totalDistance} km`
        );

        console.log(
            `Total travel time: ${history.totalTravelTime} minutes`
        );


        await mongoose.connection.close();

        console.log(
            "✅ Database connection closed"
        );

    } catch (error) {

        console.error(
            "❌ Seed failed:",
            error.message
        );

        process.exit(1);
    }
}


seedDatabase();