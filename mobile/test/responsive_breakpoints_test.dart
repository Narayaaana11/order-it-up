import 'package:flutter_test/flutter_test.dart';
import 'package:order_it_up_mobile/core/responsive/responsive_layout.dart';

void main() {
  group('ResponsiveBreakpoints Tests', () {
    test('Identifies smartphone screens (< 600dp)', () {
      expect(ResponsiveBreakpoints.getScreenType(360), DeviceScreenType.phone);
      expect(ResponsiveBreakpoints.getScreenType(414), DeviceScreenType.phone);
      expect(ResponsiveBreakpoints.getScreenType(599), DeviceScreenType.phone);
    });

    test('Identifies tablet screens (600dp - 1099dp)', () {
      expect(ResponsiveBreakpoints.getScreenType(600), DeviceScreenType.tablet);
      expect(ResponsiveBreakpoints.getScreenType(768), DeviceScreenType.tablet);
      expect(ResponsiveBreakpoints.getScreenType(834), DeviceScreenType.tablet);
      expect(ResponsiveBreakpoints.getScreenType(1024), DeviceScreenType.tablet);
      expect(ResponsiveBreakpoints.getScreenType(1099), DeviceScreenType.tablet);
    });

    test('Identifies desktop / wide screens (>= 1100dp)', () {
      expect(ResponsiveBreakpoints.getScreenType(1100), DeviceScreenType.desktop);
      expect(ResponsiveBreakpoints.getScreenType(1440), DeviceScreenType.desktop);
      expect(ResponsiveBreakpoints.getScreenType(1920), DeviceScreenType.desktop);
    });

    test('Calculates adaptive grid column counts correctly', () {
      // Phone width ~360dp with min item width 160 => 2 columns
      expect(ResponsiveBreakpoints.getGridColumnCount(360, itemMinWidth: 160), 2);

      // Tablet width ~768dp with min item width 170 => 4 columns
      expect(ResponsiveBreakpoints.getGridColumnCount(768, itemMinWidth: 170), 4);

      // Wide tablet ~1024dp with min item width 170 => 6 columns
      expect(ResponsiveBreakpoints.getGridColumnCount(1024, itemMinWidth: 170), 6);
    });
  });
}
