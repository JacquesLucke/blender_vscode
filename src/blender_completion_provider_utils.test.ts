import { guesFuncSignature, removeCommonPrefixSuffix } from './blender_completion_provider_utils';

describe('removeCommonPrefix', () => {
  it('item longer than line', () => {
    expect(removeCommonPrefixSuffix('bpy.data.objects', 'bpy.')).toBe('data.objects');
    expect(removeCommonPrefixSuffix('bpy.data.objects', 'bpy.da')).toBe('ta.objects');
    expect(removeCommonPrefixSuffix('bpy.data.objects[\'', 'bpy')).toBe('.data.objects[\'');
  });
  it('line same len item', () => {
    expect(removeCommonPrefixSuffix('bpy.data.', 'bpy.data.')).toBe('');
  });
  it('line longer than item', () => {
    expect(removeCommonPrefixSuffix('', 'bpy.data')).toBe('');
    expect(removeCommonPrefixSuffix('bpy.ops.get(', '')).toBe('bpy.ops.get(');
    expect(removeCommonPrefixSuffix('bpy.ops.get(type=\'NONE\')', 'bpy.ops.get(')).toBe('type=\'NONE\')');
  });
  it('line longer than item with repeated text', () => {
    expect(removeCommonPrefixSuffix('bpy.data.objects', 'D = bpy.data; bpy.data.')).toBe('objects');
  });
});


describe('guesFuncSignature', () => {
  it('returns the line itself if there is only one line', () => {
    expect(guesFuncSignature('singleLine')).toBe('singleLine');
    expect(guesFuncSignature('')).toBe('');
  });

  it('returns the second line if it contains parentheses', () => {
    expect(guesFuncSignature('first line\nsecondLine()')).toBe('secondLine()');
  });
  it('strip typical function signature', () => {
    expect(guesFuncSignature('ignore\n.. method:: myFunc(arg)')).toBe('myFunc(arg)');
  });

  it('returns the first line if the second line has no parentheses', () => {
    expect(guesFuncSignature('first line\nsecond line')).toBe('first line');
  });

  it('handles multiple lines correctly', () => {
    const text = `first line
.. method:: exampleFunc(arg1, arg2)
third line`;
    expect(guesFuncSignature(text)).toBe('exampleFunc(arg1, arg2)');
  });
});