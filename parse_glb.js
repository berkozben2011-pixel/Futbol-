const fs = require('fs');
const path = require('path');

function readGLB(filePath) {
  const data = fs.readFileSync(filePath);
  const name = path.basename(filePath);

  if (data.length < 12 || data.toString('ascii', 0, 4) !== 'glTF') {
    console.log(`${name}: Not a valid GLB`);
    return;
  }

  const version = data.readUInt32LE(4);
  const totalLength = data.readUInt32LE(8);

  // Read chunks
  let offset = 12;
  let json = null;
  let bin = null;

  while (offset < totalLength) {
    if (offset + 8 > data.length) break;
    const chunkLen = data.readUInt32LE(offset);
    const chunkType = data.readUInt32LE(offset + 4);
    const chunkData = data.slice(offset + 8, offset + 8 + chunkLen);

    if (chunkType === 0x4E4F534A) { // 'JSON'
      json = JSON.parse(chunkData.toString('utf8'));
    } else if (chunkType === 0x004E4942) { // 'BIN'
      bin = chunkData;
    }
    offset += 8 + chunkLen;
    // chunk length must be multiple of 4
    if (chunkLen % 4 !== 0) offset += 4 - (chunkLen % 4);
  }

  if (!json) {
    console.log(`${name}: No JSON chunk found`);
    return;
  }

  console.log(`\n=== ${name} ===`);
  console.log(`  Version: ${version}, TotalLength: ${totalLength}`);
  console.log(`  Meshes: ${json.meshes ? json.meshes.length : 0}`);
  console.log(`  Nodes: ${json.nodes ? json.nodes.length : 0}`);
  console.log(`  Skins: ${json.skins ? json.skins.length : 0}`);
  console.log(`  Animations: ${json.animations ? json.animations.length : 0}`);
  console.log(`  Accessors: ${json.accessors ? json.accessors.length : 0}`);
  console.log(`  BufferViews: ${json.bufferViews ? json.bufferViews.length : 0}`);
  console.log(`  Buffers: ${json.buffers ? json.buffers.length : 0}`);
  console.log(`  Materials: ${json.materials ? json.materials.length : 0}`);
  console.log(`  Images: ${json.images ? json.images.length : 0}`);
  console.log(`  Textures: ${json.textures ? json.textures.length : 0}`);

  if (json.animations && json.animations.length > 0) {
    console.log('  --- Animations ---');
    json.animations.forEach((anim, i) => {
      const name = anim.name || `anim_${i}`;
      const channels = anim.channels ? anim.channels.length : 0;
      const samplers = anim.samplers ? anim.samplers.length : 0;
      console.log(`    [${i}] ${name} - channels: ${channels}, samplers: ${samplers}`);
      // Print channel target nodes
      if (anim.channels) {
        anim.channels.forEach((ch, ci) => {
          const targetNode = ch.target && ch.target.node;
          const path = ch.target && ch.target.path;
          console.log(`      channel ${ci}: targetNode=${targetNode}, path=${path}`);
        });
      }
    });
  }

  // Print node hierarchy
  if (json.nodes) {
    console.log('  --- Nodes ---');
    json.nodes.forEach((node, i) => {
      const hasChildren = node.children && node.children.length > 0;
      const hasMesh = node.mesh !== undefined;
      const hasSkin = node.skin !== undefined;
      const hasTranslation = node.translation ? `T(${node.translation.map(x => x.toFixed(2)).join(',')})` : '';
      const hasRotation = node.rotation ? `R(${node.rotation.map(x => x.toFixed(3)).join(',')})` : '';
      const hasScale = node.scale ? `S(${node.scale.map(x => x.toFixed(2)).join(',')})` : '';
      const extras = node.extras ? `extras=${JSON.stringify(node.extras)}` : '';
      console.log(`    [${i}] ${node.name || 'unnamed'} mesh=${hasMesh} skin=${hasSkin} ${hasTranslation} ${hasRotation} ${hasScale} ${extras}`);
    });
  }

  // Check for Draco extension
  if (json.extensionsUsed) {
    console.log(`  ExtensionsUsed: ${json.extensionsUsed.join(', ')}`);
  }
  if (json.extensionsRequired) {
    console.log(`  ExtensionsRequired: ${json.extensionsRequired.join(', ')}`);
  }

  // Check buffer sizes
  if (json.buffers && json.buffers.length > 0) {
    const buf = json.buffers[0];
    console.log(`  Buffer 0: byteLength=${buf.byteLength}, uri=${buf.uri ? 'external' : 'embedded'}`);
  }
}

const charsDir = path.join(__dirname, 'client', 'assets', 'models', 'characters');
const files = fs.readdirSync(charsDir).filter(f => f.endsWith('.glb'));
files.forEach(f => readGLB(path.join(charsDir, f)));