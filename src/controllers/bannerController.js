const Banner = require('../models/Banner');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendValidationError, sendNotFound } = require('../utils/responseHandler');

// @desc    Get all active banners
// @route   GET /api/banners
// @access  Public
// @desc    Get banners
// @route   GET /api/banners
// @access  Public
exports.getBanners = asyncHandler(async (req, res) => {
    const filter = {};

    // Only show active banners to public unless 'all' is specified
    if (req.query.all !== 'true') {
        filter.isActive = true;
    }

    const banners = await Banner.find(filter).sort({ order: 1, createdAt: -1 });
    return sendSuccess(res, banners, 'Banners retrieved successfully');
});

// @desc    Create a new banner
// @route   POST /api/banners
// @access  Private (Admin)
exports.createBanner = asyncHandler(async (req, res) => {
    const { title, imageUrl, link, order, isActive } = req.body;

    if (!imageUrl) {
        return sendValidationError(res, 'Image URL is required');
    }

    const banner = await Banner.create({
        title,
        imageUrl,
        link,
        order: order || 0,
        isActive: isActive !== undefined ? isActive : true,
    });

    return sendSuccess(res, banner, 'Banner created successfully', 201);
});

// @desc    Update a banner
// @route   PUT /api/banners/:id
// @access  Private (Admin)
exports.updateBanner = asyncHandler(async (req, res) => {
    let banner = await Banner.findById(req.params.id);

    if (!banner) {
        return sendNotFound(res, 'Banner not found');
    }

    const { title, imageUrl, link, order, isActive } = req.body;

    banner.title = title !== undefined ? title : banner.title;
    banner.imageUrl = imageUrl !== undefined ? imageUrl : banner.imageUrl;
    banner.link = link !== undefined ? link : banner.link;
    banner.order = order !== undefined ? order : banner.order;
    banner.isActive = isActive !== undefined ? isActive : banner.isActive;

    await banner.save();

    return sendSuccess(res, banner, 'Banner updated successfully');
});

// @desc    Delete a banner
// @route   DELETE /api/banners/:id
// @access  Private (Admin)
exports.deleteBanner = asyncHandler(async (req, res) => {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
        return sendNotFound(res, 'Banner not found');
    }

    await banner.deleteOne();

    return sendSuccess(res, null, 'Banner deleted successfully');
});
