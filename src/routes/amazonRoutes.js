const express = require('express');
const router = express.Router();
const { searchItems, getItems, getBrowseNodes } = require('../controllers/amazonController');

router.post('/search', searchItems);
router.post('/items', getItems);
router.post('/browse-nodes', getBrowseNodes);

module.exports = router;

