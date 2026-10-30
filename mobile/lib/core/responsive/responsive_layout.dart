import 'package:flutter/material.dart';

enum DeviceScreenType {
  phone,
  tablet,
  desktop,
}

class ResponsiveBreakpoints {
  static const double phoneMax = 600.0;
  static const double tabletMax = 1100.0;

  static DeviceScreenType getScreenType(double width) {
    if (width < phoneMax) {
      return DeviceScreenType.phone;
    } else if (width < tabletMax) {
      return DeviceScreenType.tablet;
    } else {
      return DeviceScreenType.desktop;
    }
  }

  static bool isPhone(BuildContext context) {
    return MediaQuery.of(context).size.width < phoneMax;
  }

  static bool isTablet(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    return width >= phoneMax && width < tabletMax;
  }

  static bool isDesktop(BuildContext context) {
    return MediaQuery.of(context).size.width >= tabletMax;
  }

  static bool isTabletOrLarger(BuildContext context) {
    return MediaQuery.of(context).size.width >= phoneMax;
  }

  /// Calculates optimal grid column count based on available container width
  static int getGridColumnCount(double width, {double itemMinWidth = 160}) {
    final count = (width / itemMinWidth).floor();
    return count < 1 ? 1 : count;
  }
}

typedef ResponsiveWidgetBuilder = Widget Function(
  BuildContext context,
  BoxConstraints constraints,
  DeviceScreenType screenType,
);

class ResponsiveLayout extends StatelessWidget {
  final Widget Function(BuildContext context, BoxConstraints constraints)?
      phone;
  final Widget Function(BuildContext context, BoxConstraints constraints)?
      tablet;
  final Widget Function(BuildContext context, BoxConstraints constraints)?
      desktop;
  final ResponsiveWidgetBuilder? builder;

  const ResponsiveLayout({
    Key? key,
    this.phone,
    this.tablet,
    this.desktop,
    this.builder,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final screenType =
            ResponsiveBreakpoints.getScreenType(constraints.maxWidth);

        if (builder != null) {
          return builder!(context, constraints, screenType);
        }

        switch (screenType) {
          case DeviceScreenType.desktop:
            if (desktop != null) return desktop!(context, constraints);
            if (tablet != null) return tablet!(context, constraints);
            return phone!(context, constraints);
          case DeviceScreenType.tablet:
            if (tablet != null) return tablet!(context, constraints);
            return phone!(context, constraints);
          case DeviceScreenType.phone:
          default:
            return phone!(context, constraints);
        }
      },
    );
  }
}
