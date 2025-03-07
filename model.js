const tf = require('@tensorflow/tfjs');
const natural = require('natural');
const data = require('./data');

// Tokenizer để chuyển text thành vectors
const tokenizer = new natural.WordTokenizer();

// Tạo vocabulary từ patterns và thêm xử lý từ đồng nghĩa
const createVocabulary = () => {
    const vocabulary = new Set();
    data.intents.forEach(intent => {
        intent.patterns.forEach(pattern => {
            const tokens = tokenizer.tokenize(pattern.toLowerCase());
            tokens.forEach(token => {
                vocabulary.add(token);
                // Thêm các từ đồng nghĩa tiếng Việt cơ bản
                if (token === "xin") vocabulary.add("làm");
                if (token === "chào") vocabulary.add("hi");
                if (token === "tạm biệt") {
                    vocabulary.add("bye");
                    vocabulary.add("goodbye");
                }
            });
        });
    });
    return Array.from(vocabulary);
};

// Chuyển text thành vector với trọng số TF-IDF đơn giản hóa
const textToVector = (text, vocabulary) => {
    const tokens = tokenizer.tokenize(text.toLowerCase());
    return vocabulary.map(word => tokens.includes(word) ? 1 : 0);
};

// Tạo training data với data augmentation cơ bản
const prepareTrainingData = () => {
    const vocabulary = createVocabulary();
    const trainX = [];
    const trainY = [];

    data.intents.forEach((intent, intentIndex) => {
        intent.patterns.forEach(pattern => {
            // Thêm pattern gốc
            trainX.push(textToVector(pattern, vocabulary));
            const output = new Array(data.intents.length).fill(0);
            output[intentIndex] = 1;
            trainY.push(output);

            // Data augmentation đơn giản
            trainX.push(textToVector(pattern + '?', vocabulary));
            trainY.push(output);
            trainX.push(textToVector('ơi ' + pattern, vocabulary));
            trainY.push(output);
        });
    });

    return {
        vocabulary,
        trainX: tf.tensor2d(trainX),
        trainY: tf.tensor2d(trainY)
    };
};

// Tạo model với kiến trúc đơn giản hơn
const createModel = (inputSize, outputSize) => {
    const model = tf.sequential();

    model.add(tf.layers.dense({
        inputShape: [inputSize],
        units: 128,
        activation: 'relu'
    }));

    model.add(tf.layers.dropout({ rate: 0.2 }));

    model.add(tf.layers.dense({
        units: 64,
        activation: 'relu'
    }));

    model.add(tf.layers.dense({
        units: outputSize,
        activation: 'softmax'
    }));

    model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    return model;
};

// Training process đơn giản hóa
const trainModel = async () => {
    const { vocabulary, trainX, trainY } = prepareTrainingData();
    const model = createModel(vocabulary.length, data.intents.length);

    await model.fit(trainX, trainY, {
        epochs: 50,
        batchSize: 16,
        shuffle: true,
        validationSplit: 0.1
    });

    return { model, vocabulary };
};

module.exports = { trainModel, textToVector }; 