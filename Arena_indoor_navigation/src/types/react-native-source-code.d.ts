declare module 'react-native/Libraries/NativeModules/specs/NativeSourceCode' {
  namespace SourceCode {
    function getConstants(): { scriptURL: string | null };
  }

  export default SourceCode;
}
