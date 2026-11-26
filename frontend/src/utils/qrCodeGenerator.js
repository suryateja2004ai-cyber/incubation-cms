// qrCodeGenerator.js
// Pure JavaScript QR Code Generator (ISO/IEC 18004 compliant).
// Generates clean SVG markup or matrix without external dependencies or network calls.

// QR Error Correction Levels
export const QrErrorCorrectLevel = {
  L: 1, // Recovers ~7% of data
  M: 0, // Recovers ~15% of data
  Q: 3, // Recovers ~25% of data
  H: 2  // Recovers ~30% of data
};

// Mode indicators
const MODE_8BIT_BYTE = 1 << 2;

// Polynomial operations for Reed-Solomon error correction
const QRMath = {
  EXP_TABLE: new Array(256),
  LOG_TABLE: new Array(256),
  init() {
    for (let i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
    for (let i = 8; i < 256; i++) {
      QRMath.EXP_TABLE[i] =
        QRMath.EXP_TABLE[i - 4] ^
        QRMath.EXP_TABLE[i - 5] ^
        QRMath.EXP_TABLE[i - 6] ^
        QRMath.EXP_TABLE[i - 8];
    }
    for (let i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;
  },
  glog(n) {
    if (n < 1) throw new Error('glog(' + n + ')');
    return QRMath.LOG_TABLE[n];
  },
  gexp(n) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return QRMath.EXP_TABLE[n];
  }
};
QRMath.init();

class QRPolynomial {
  constructor(num, shift = 0) {
    let offset = 0;
    while (offset < num.length && num[offset] === 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (let i = 0; i < num.length - offset; i++) this.num[i] = num[offset + i];
    for (let i = 0; i < shift; i++) this.num[num.length - offset + i] = 0;
  }
  get(index) { return this.num[index]; }
  getLength() { return this.num.length; }
  multiply(e) {
    const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
    for (let i = 0; i < this.getLength(); i++) {
      for (let j = 0; j < e.getLength(); j++) {
        num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
      }
    }
    return new QRPolynomial(num);
  }
  mod(e) {
    if (this.getLength() - e.getLength() < 0) return this;
    const ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
    const num = new Array(this.getLength());
    for (let i = 0; i < this.getLength(); i++) num[i] = this.get(i);
    for (let i = 0; i < e.getLength(); i++) {
      num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
    }
    return new QRPolynomial(num).mod(e);
  }
}

class QRRSBlock {
  constructor(totalCount, dataCount) {
    this.totalCount = totalCount;
    this.dataCount = dataCount;
  }
  static getRSBlocks(typeNumber, errorCorrectLevel) {
    const rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
    if (!rsBlock) throw new Error('bad rs block @ typeNumber:' + typeNumber);
    const length = rsBlock.length / 3;
    const list = [];
    for (let i = 0; i < length; i++) {
      const count = rsBlock[i * 3 + 0];
      const totalCount = rsBlock[i * 3 + 1];
      const dataCount = rsBlock[i * 3 + 2];
      for (let j = 0; j < count; j++) {
        list.push(new QRRSBlock(totalCount, dataCount));
      }
    }
    return list;
  }
  static getRsBlockTable(typeNumber, errorCorrectLevel) {
    switch (errorCorrectLevel) {
      case QrErrorCorrectLevel.L:
        return [
          [1, 26, 19], [1, 44, 34], [1, 70, 55], [1, 100, 80],
          [1, 134, 108], [2, 86, 68], [2, 98, 78], [2, 121, 97],
          [2, 146, 116], [2, 86, 68, 2, 87, 69]
        ][typeNumber - 1];
      case QrErrorCorrectLevel.M:
        return [
          [1, 26, 16], [1, 44, 28], [1, 70, 44], [2, 50, 32],
          [2, 67, 43], [4, 43, 27], [2, 61, 43, 2, 62, 44],
          [2, 73, 53, 2, 74, 54], [3, 80, 58, 2, 81, 59],
          [4, 43, 26, 3, 44, 27]
        ][typeNumber - 1];
      case QrErrorCorrectLevel.Q:
        return [
          [1, 26, 13], [1, 44, 22], [2, 35, 17], [2, 50, 24],
          [2, 33, 15, 2, 34, 16], [4, 28, 15], [4, 43, 24, 2, 44, 25],
          [4, 45, 23, 2, 46, 24], [4, 48, 25, 4, 49, 26],
          [6, 43, 23, 2, 44, 24]
        ][typeNumber - 1];
      case QrErrorCorrectLevel.H:
        return [
          [1, 26, 9], [1, 44, 16], [2, 35, 13], [4, 25, 9],
          [2, 33, 11, 2, 34, 12], [4, 28, 11], [4, 33, 14, 1, 34, 15],
          [4, 39, 14, 2, 40, 15], [4, 40, 14, 4, 41, 15],
          [6, 36, 15, 2, 37, 16]
        ][typeNumber - 1];
      default:
        return undefined;
    }
  }
}

class QRBitBuffer {
  constructor() {
    this.buffer = [];
    this.length = 0;
  }
  get(index) {
    const bufIndex = Math.floor(index / 8);
    return ((this.buffer[bufIndex] >>> (7 - (index % 8))) & 1) === 1;
  }
  put(num, length) {
    for (let i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  }
  putBit(bit) {
    const bufIndex = Math.floor(this.length / 8);
    if (this.buffer.length <= bufIndex) this.buffer.push(0);
    if (bit) this.buffer[bufIndex] |= 0x80 >>> (this.length % 8);
    this.length++;
  }
}

class QRCodeModel {
  constructor(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }
  addData(data) {
    this.dataList.push(data);
    this.dataCache = null;
  }
  isDark(row, col) {
    if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
      throw new Error(row + ',' + col);
    }
    return this.modules[row][col];
  }
  getModuleCount() {
    return this.moduleCount;
  }
  make() {
    if (this.typeNumber < 1) {
      let typeNumber = 1;
      for (; typeNumber < 10; typeNumber++) {
        const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);
        const buffer = new QRBitBuffer();
        let totalDataCount = 0;
        for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
        for (let i = 0; i < this.dataList.length; i++) {
          const data = this.dataList[i];
          buffer.put(MODE_8BIT_BYTE, 4);
          buffer.put(data.length, typeNumber < 10 ? 8 : 16);
          for (let j = 0; j < data.length; j++) buffer.put(data.charCodeAt(j), 8);
        }
        if (buffer.length <= totalDataCount * 8) {
          this.typeNumber = typeNumber;
          break;
        }
      }
    }
    this.makeImpl(false, this.getBestMaskPattern());
  }
  makeImpl(test, maskPattern) {
    this.moduleCount = this.typeNumber * 4 + 17;
    this.modules = new Array(this.moduleCount);
    for (let row = 0; row < this.moduleCount; row++) {
      this.modules[row] = new Array(this.moduleCount).fill(null);
    }
    this.setupPositionProbePattern(0, 0);
    this.setupPositionProbePattern(this.moduleCount - 7, 0);
    this.setupPositionProbePattern(0, this.moduleCount - 7);
    this.setupPositionAdjustPattern();
    this.setupTimingPattern();
    this.setupTypeInfo(test, maskPattern);
    if (this.typeNumber >= 7) this.setupTypeNumber(test);
    if (this.dataCache == null) {
      this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
    }
    this.mapData(this.dataCache, maskPattern);
  }
  setupPositionProbePattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue;
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue;
        if (
          (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
          (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
          (2 <= r && r <= 4 && 2 <= c && c <= 4)
        ) {
          this.modules[row + r][col + c] = true;
        } else {
          this.modules[row + r][col + c] = false;
        }
      }
    }
  }
  getBestMaskPattern() {
    let minLostPoint = 0;
    let pattern = 0;
    for (let i = 0; i < 8; i++) {
      this.makeImpl(true, i);
      const lostPoint = this.getLostPoint();
      if (i === 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint;
        pattern = i;
      }
    }
    return pattern;
  }
  setupTimingPattern() {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] != null) continue;
      this.modules[r][6] = r % 2 === 0;
    }
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] != null) continue;
      this.modules[6][c] = c % 2 === 0;
    }
  }
  setupPositionAdjustPattern() {
    const pos = QRCodeModel.getPatternPosition(this.typeNumber);
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i];
        const col = pos[j];
        if (this.modules[row][col] != null) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            this.modules[row + r][col + c] =
              r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
          }
        }
      }
    }
  }
  setupTypeInfo(test, maskPattern) {
    const data = (this.errorCorrectLevel << 3) | maskPattern;
    const bits = QRCodeModel.getBCHTypeInfo(data);
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 6) this.modules[i][8] = mod;
      else if (i < 8) this.modules[i + 1][8] = mod;
      else this.modules[this.moduleCount - 15 + i][8] = mod;
    }
    for (let i = 0; i < 15; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
      else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
      else this.modules[8][15 - i - 1] = mod;
    }
    this.modules[this.moduleCount - 8][8] = !test;
  }
  setupTypeNumber(test) {
    const bits = QRCodeModel.getBCHTypeNumber(this.typeNumber);
    for (let i = 0; i < 18; i++) {
      const mod = !test && ((bits >> i) & 1) === 1;
      this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod;
      this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
    }
  }
  mapData(data, maskPattern) {
    let inc = -1;
    let row = this.moduleCount - 1;
    let bitIndex = 7;
    let byteIndex = 0;
    const maskFunc = QRCodeModel.getMaskFunc(maskPattern);
    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] == null) {
            let dark = false;
            if (byteIndex < data.length) {
              dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
            }
            if (maskFunc(row, col - c)) dark = !dark;
            this.modules[row][col - c] = dark;
            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }
        row += inc;
        if (row < 0 || this.moduleCount <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }
  getLostPoint() {
    const count = this.moduleCount;
    let lostPoint = 0;
    // Level 1: same color in row/col
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        let sameCount = 0;
        const dark = this.modules[row][col];
        for (let r = -1; r <= 1; r++) {
          if (row + r < 0 || count <= row + r) continue;
          for (let c = -1; c <= 1; c++) {
            if (col + c < 0 || count <= col + c) continue;
            if (r === 0 && c === 0) continue;
            if (dark === this.modules[row + r][col + c]) sameCount++;
          }
        }
        if (sameCount > 5) lostPoint += 3 + sameCount - 5;
      }
    }
    return lostPoint;
  }
  static createData(typeNumber, errorCorrectLevel, dataList) {
    const rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
    const buffer = new QRBitBuffer();
    for (let i = 0; i < dataList.length; i++) {
      const data = dataList[i];
      buffer.put(MODE_8BIT_BYTE, 4);
      buffer.put(data.length, typeNumber < 10 ? 8 : 16);
      for (let j = 0; j < data.length; j++) buffer.put(data.charCodeAt(j), 8);
    }
    let totalDataCount = 0;
    for (let i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
    if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
    while (buffer.length % 8 !== 0) buffer.putBit(false);
    while (true) {
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0xec, 8);
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0x11, 8);
    }
    return QRCodeModel.createBytes(buffer, rsBlocks);
  }
  static createBytes(buffer, rsBlocks) {
    let offset = 0;
    let maxDcCount = 0;
    let maxEcCount = 0;
    const dcdata = new Array(rsBlocks.length);
    const ecdata = new Array(rsBlocks.length);
    for (let r = 0; r < rsBlocks.length; r++) {
      const dcCount = rsBlocks[r].dataCount;
      const ecCount = rsBlocks[r].totalCount - dcCount;
      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);
      dcdata[r] = new Array(dcCount);
      for (let i = 0; i < dcdata[r].length; i++) {
        dcdata[r][i] = 0xff & buffer.buffer[i + offset];
      }
      offset += dcCount;
      const rsPoly = QRCodeModel.getErrorCorrectPolynomial(ecCount);
      const rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
      const modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.getLength() - 1);
      for (let i = 0; i < ecdata[r].length; i++) {
        const modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
      }
    }
    let totalCodeCount = 0;
    for (let i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
    const data = new Array(totalCodeCount);
    let index = 0;
    for (let i = 0; i < maxDcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < dcdata[r].length) data[index++] = dcdata[r][i];
      }
    }
    for (let i = 0; i < maxEcCount; i++) {
      for (let r = 0; r < rsBlocks.length; r++) {
        if (i < ecdata[r].length) data[index++] = ecdata[r][i];
      }
    }
    return data;
  }
  static getErrorCorrectPolynomial(errorCorrectLength) {
    let a = new QRPolynomial([1], 0);
    for (let i = 0; i < errorCorrectLength; i++) {
      a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
    }
    return a;
  }
  static getMaskFunc(maskPattern) {
    switch (maskPattern) {
      case 0: return (i, j) => (i + j) % 2 === 0;
      case 1: return (i) => i % 2 === 0;
      case 2: return (i, j) => j % 3 === 0;
      case 3: return (i, j) => (i + j) % 3 === 0;
      case 4: return (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case 5: return (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0;
      case 6: return (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
      case 7: return (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
      default: throw new Error('bad maskPattern:' + maskPattern);
    }
  }
  static getPatternPosition(typeNumber) {
    switch (typeNumber) {
      case 1: return [];
      case 2: return [6, 18];
      case 3: return [6, 22];
      case 4: return [6, 26];
      case 5: return [6, 30];
      case 6: return [6, 34];
      case 7: return [6, 22, 38];
      case 8: return [6, 24, 42];
      case 9: return [6, 26, 46];
      case 10: return [6, 28, 50];
      default: return [];
    }
  }
  static getBCHTypeInfo(data) {
    let d = data << 10;
    while (QRCodeModel.getBCHDigit(d) - QRCodeModel.getBCHDigit(1335) >= 0) {
      d ^= 1335 << (QRCodeModel.getBCHDigit(d) - QRCodeModel.getBCHDigit(1335));
    }
    return ((data << 10) | d) ^ 21522;
  }
  static getBCHTypeNumber(data) {
    let d = data << 12;
    while (QRCodeModel.getBCHDigit(d) - QRCodeModel.getBCHDigit(7973) >= 0) {
      d ^= 7973 << (QRCodeModel.getBCHDigit(d) - QRCodeModel.getBCHDigit(7973));
    }
    return (data << 12) | d;
  }
  static getBCHDigit(data) {
    let digit = 0;
    while (data !== 0) {
      digit++;
      data >>>= 1;
    }
    return digit;
  }
}

/**
 * Generate QR code matrix and SVG string for any text
 * @param {string} text - text to encode (e.g. HTTPS URL)
 * @param {object} options - { size, margin, ecl }
 * @returns {object} { matrix, svg, size, moduleCount }
 */
export function generateQrSvg(text, options = {}) {
  const size = options.size || 200;
  const margin = options.margin !== undefined ? options.margin : 4;
  const ecl = options.ecl || QrErrorCorrectLevel.M;

  const qr = new QRCodeModel(0, ecl);
  qr.addData(text);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const totalCells = moduleCount + margin * 2;
  const cellSize = size / totalCells;

  // Build SVG path for dark modules
  let path = '';
  const matrix = [];
  for (let r = 0; r < moduleCount; r++) {
    const row = [];
    for (let c = 0; c < moduleCount; c++) {
      const dark = qr.isDark(r, c);
      row.push(dark);
      if (dark) {
        const x = (c + margin) * cellSize;
        const y = (r + margin) * cellSize;
        path += `M${x.toFixed(2)},${y.toFixed(2)}h${cellSize.toFixed(2)}v${cellSize.toFixed(2)}h-${cellSize.toFixed(2)}z `;
      }
    }
    matrix.push(row);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" shape-rendering="crispEdges">
    <rect width="${size}" height="${size}" fill="#ffffff" />
    <path d="${path}" fill="#0f172a" />
  </svg>`;

  return {
    moduleCount,
    size,
    cellSize,
    margin,
    matrix,
    path,
    svg
  };
}
