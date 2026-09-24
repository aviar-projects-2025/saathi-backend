import mongoose from "mongoose";
import BookRide from "../model/bookride.js";
import Ride from "../model/ride.js";
import User from "../model/user.js";

export const createRideService = async (data) => {
  const startDate = new Date(data.startTime);

  const startOfDay = new Date(startDate);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startDate);
  endOfDay.setHours(23, 59, 59, 999);

  return await Ride.create(data);
};

const fetchMyRideCategory = async ({
  query,
  pageNumber,
  limitNumber,
  skip,
  sort,
}) => {
  console.log(
    "MY RIDES QUERY:",
    JSON.stringify(query, null, 2)
  );

  const totalRides =
    await Ride.countDocuments(query);

  const rides = await Ride.find(query)
    .populate(
      "createdBy",
      "firstName lastName profileImage zipcode"
    )
    .sort(sort)
    .skip(skip)
    .limit(limitNumber);

  return {
    rides,
    totalRides,
    page: pageNumber,
    limit: limitNumber,
    hasMore:
      skip + rides.length < totalRides,
  };
};

const getMyRidesCategory = async ({
  category,
  userObjectId,
  pageNumber,
  limitNumber,
  skip,
}) => {
  // =====================================================
  // VALIDATE CATEGORY
  // =====================================================

  const allowedCategories = [
    "current",
    "upcoming",
    "posts",
    "history",
  ];

  if (!allowedCategories.includes(category)) {
    throw new Error(
      "Invalid My Rides category"
    );
  }

  // =====================================================
  // MY ACCEPTED BOOKINGS
  // =====================================================

  let acceptedRideIds = [];

  if (
    category === "current" ||
    category === "upcoming" ||
    category === "history"
  ) {
    acceptedRideIds =
      await BookRide.find({
        requestedBy: userObjectId,
        status: "ACCEPTED",
      }).distinct("rideId");
  }

  // =====================================================
  // POSTS
  // =====================================================

  if (category === "posts") {
    const query = {
      createdBy: userObjectId,
    };

    const totalRides =
      await Ride.countDocuments(query);

    const rides = await Ride.find(query)
      .populate(
        "createdBy",
        "firstName lastName profileImage zipcode"
      )
      .sort({
        startTime: -1,
      })
      .skip(skip)
      .limit(limitNumber);

    return {
      rides,
      totalRides,
      page: pageNumber,
      limit: limitNumber,
      hasMore:
        skip + rides.length < totalRides,
    };
  }

  // =====================================================
  // CURRENT
  // =====================================================

  if (category === "current") {
    const now = new Date();

    const query = {
      $and: [
        {
          $or: [
            {
              createdBy: userObjectId,
            },
            {
              _id: {
                $in: acceptedRideIds,
              },
            },
          ],
        },

        {
          startTime: {
            $lte: now,
          },
        },

        {
          travelStatus: {
            $nin: [
              "Completed",
              "Cancelled",
            ],
          },
        },
      ],
    };

    return await fetchMyRideCategory({
      query,
      pageNumber,
      limitNumber,
      skip,
      sort: {
        startTime: 1,
      },
    });
  }

  // =====================================================
  // UPCOMING
  // =====================================================

  if (category === "upcoming") {
    const now = new Date();

    const query = {
      $and: [
        {
          $or: [
            {
              createdBy: userObjectId,

              startTime: {
                $gt: now,
              },

              travelStatus: {
                $nin: [
                  "Completed",
                  "Cancelled",
                ],
              },
            },

            {
              _id: {
                $in: acceptedRideIds,
              },

              startTime: {
                $gt: now,
              },
            },
          ],
        },
      ],
    };

    return await fetchMyRideCategory({
      query,
      pageNumber,
      limitNumber,
      skip,
      sort: {
        startTime: 1,
      },
    });
  }

  // =====================================================
  // HISTORY
  // =====================================================

  if (category === "history") {
    const query = {
      $and: [
        {
          $or: [
            {
              createdBy: userObjectId,
            },
            {
              _id: {
                $in: acceptedRideIds,
              },
            },
          ],
        },

        {
          travelStatus: {
            $in: [
              "Completed",
              "Cancelled",
            ],
          },
        },
      ],
    };

    return await fetchMyRideCategory({
      query,
      pageNumber,
      limitNumber,
      skip,
      sort: {
        startTime: -1,
      },
    });
  }
};

// Get all
export const getAllRideService = async ({
  type = "find",
  category,

  userId,

  searchFrom,
  searchDestination,
  search,

  transportMode,
  gender,
  fuelSharing,
  language,

  page = 1,
  limit = 10,
}) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // =====================================================
  // PAGINATION
  // =====================================================

  const pageNumber = Math.max(Number(page) || 1, 1);
  const limitNumber = Math.min(
    Math.max(Number(limit) || 10, 1),
    50
  );

  const skip = (pageNumber - 1) * limitNumber;

  // =====================================================
  // MY RIDES
  // =====================================================

  if (type === "my") {
    return await getMyRidesCategory({
      category,
      userObjectId,
      pageNumber,
      limitNumber,
      skip,
    });
  }

  // =====================================================
  // FIND RIDES
  // =====================================================

  const conditions = [];

  // -----------------------------------------------------
  // Exclude current user's rides
  // -----------------------------------------------------

  conditions.push({
    createdBy: {
      $ne: userObjectId,
    },
  });

  // -----------------------------------------------------
  // Only future rides
  // -----------------------------------------------------

  conditions.push({
    startTime: {
      $gt: new Date(),
    },
  });

  // -----------------------------------------------------
  // Only OPEN rides
  // -----------------------------------------------------

  conditions.push({
    status: "OPEN",
  });

  // -----------------------------------------------------
  // Exclude cancelled rides
  // -----------------------------------------------------

  conditions.push({
    travelStatus: {
      $ne: "Cancelled",
    },
  });

  // =====================================================
  // FROM
  // =====================================================

  if (searchFrom?.trim()) {
    const value = searchFrom.trim();

    conditions.push({
      $or: [
        {
          from: {
            $regex: value,
            $options: "i",
          },
        },
        {
          fromAirport: {
            $regex: value,
            $options: "i",
          },
        },
        {
          fromCountry: {
            $regex: value,
            $options: "i",
          },
        },
      ],
    });
  }

  // =====================================================
  // DESTINATION
  // =====================================================

  if (searchDestination?.trim()) {
    const value = searchDestination.trim();

    conditions.push({
      $or: [
        {
          destination: {
            $regex: value,
            $options: "i",
          },
        },
        {
          toAirport: {
            $regex: value,
            $options: "i",
          },
        },
        {
          toCountry: {
            $regex: value,
            $options: "i",
          },
        },
      ],
    });
  }

  // =====================================================
  // GENERAL SEARCH
  // =====================================================

  if (search?.trim()) {
    const searchText = search.trim();

    const matchingUsers = await User.find({
      $or: [
        {
          firstName: {
            $regex: searchText,
            $options: "i",
          },
        },
        {
          lastName: {
            $regex: searchText,
            $options: "i",
          },
        },
      ],
    }).select("_id");

    const matchingUserIds = matchingUsers.map(
      (user) => user._id
    );

    const generalSearchConditions = [
      {
        from: {
          $regex: searchText,
          $options: "i",
        },
      },
      {
        destination: {
          $regex: searchText,
          $options: "i",
        },
      },
      {
        fromAirport: {
          $regex: searchText,
          $options: "i",
        },
      },
      {
        destinationAirport: {
          $regex: searchText,
          $options: "i",
        },
      },
      {
        toAirport: {
          $regex: searchText,
          $options: "i",
        },
      },
      {
        airlineName: {
          $regex: searchText,
          $options: "i",
        },
      },
      {
        flightNumber: {
          $regex: searchText,
          $options: "i",
        },
      },
    ];

    if (matchingUserIds.length > 0) {
      generalSearchConditions.push({
        createdBy: {
          $in: matchingUserIds,
        },
      });
    }

    conditions.push({
      $or: generalSearchConditions,
    });
  }

  // =====================================================
  // TRANSPORT MODE
  // =====================================================

  if (transportMode?.trim()) {
    conditions.push({
      modeOfTravel: transportMode.trim(),
    });
  }

  // =====================================================
  // GENDER
  // =====================================================

  if (gender?.trim()) {
    conditions.push({
      genderPreference: gender.trim(),
    });
  }

  // =====================================================
  // FUEL SHARING
  // =====================================================

  if (
    fuelSharing !== undefined &&
    fuelSharing !== ""
  ) {
    const fuelValue = fuelSharing === "true";

    conditions.push({
      $or: [
        {
          modeOfTravel: "Flight",
        },
        {
          fuelSharing: fuelValue,
        },
      ],
    });
  }

  // =====================================================
  // LANGUAGE
  // =====================================================

  if (language?.trim()) {
    conditions.push({
      language: {
        $regex: language.trim(),
        $options: "i",
      },
    });
  }

  // =====================================================
  // FINAL FIND QUERY
  // =====================================================

  const query = {
    $and: conditions,
  };

  console.log(
    "FIND RIDES QUERY:",
    JSON.stringify(query, null, 2)
  );

  // =====================================================
  // TOTAL
  // =====================================================

  const totalRides =
    await Ride.countDocuments(query);

  // =====================================================
  // FETCH
  // =====================================================

  const rides = await Ride.find(query)
    .populate(
      "createdBy",
      "firstName lastName profileImage zipcode"
    )
    .sort({
      startTime: 1,
    })
    .skip(skip)
    .limit(limitNumber);

  return {
    rides,
    totalRides,
    page: pageNumber,
    limit: limitNumber,
    hasMore:
      skip + rides.length < totalRides,
  };
};


export const getMyRideCountsService = async ({
  userId,
}) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const now = new Date();

  // =====================================================
  // GET ACCEPTED BOOKED RIDE IDS
  // =====================================================

  const acceptedRideIds = await BookRide.find({
    requestedBy: userObjectId,
    status: "ACCEPTED",
  }).distinct("rideId");

  // =====================================================
  // CURRENT
  // =====================================================

  const currentCount = await Ride.countDocuments({
    $and: [
      {
        $or: [
          {
            createdBy: userObjectId,
          },
          {
            _id: {
              $in: acceptedRideIds,
            },
          },
        ],
      },

      {
        startTime: {
          $lte: now,
        },
      },

      {
        travelStatus: {
          $nin: [
            "Completed",
            "Cancelled",
          ],
        },
      },
    ],
  });

  // =====================================================
  // UPCOMING
  // =====================================================

  const upcomingCount = await Ride.countDocuments({
    $or: [
      {
        createdBy: userObjectId,

        startTime: {
          $gt: now,
        },

        travelStatus: {
          $nin: [
            "Completed",
            "Cancelled",
          ],
        },
      },

      {
        _id: {
          $in: acceptedRideIds,
        },

        startTime: {
          $gt: now,
        },
      },
    ],
  });

  // =====================================================
  // MY POSTS
  // =====================================================

  const postsCount = await Ride.countDocuments({
    createdBy: userObjectId,
  });

  // =====================================================
  // HISTORY
  // =====================================================

  const historyCount = await Ride.countDocuments({
    $and: [
      {
        $or: [
          {
            createdBy: userObjectId,
          },
          {
            _id: {
              $in: acceptedRideIds,
            },
          },
        ],
      },

      {
        travelStatus: {
          $in: [
            "Completed",
            "Cancelled",
          ],
        },
      },
    ],
  });

  // =====================================================
  // RETURN
  // =====================================================

  return {
    current: currentCount,
    upcoming: upcomingCount,
    posts: postsCount,
    history: historyCount,
  };
};

// Get single Ride
export const getRideById = async (id) => {
  return await Ride.findById(id);
};

export const deleteRideService = async (id) => {
  return await Ride.findByIdAndDelete(id);
}
// service/ride.js

export const updateRideService = async (id, data) => {
  await BookRide.updateMany(
    { rideId: id, status: "PENDING" },
    { status: "AUTO_REJECTED" }
  );

  const existingRide = await Ride.findById(id);

  const updatedRide = await Ride.findByIdAndUpdate(id, data, {
    new: true,
  });

  if (
    existingRide.travelStatus !== "Completed" &&
    updatedRide.travelStatus === "Completed"
  ) {
    await User.findByIdAndUpdate(updatedRide.createdBy, {
      $inc: { completedRideCount: 1 },
    });
  }

  return updatedRide;
};