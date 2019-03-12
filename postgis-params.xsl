<xsl:stylesheet
	version="1.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	extension-element-prefixes=""
	exclude-result-prefixes="xsl">

  <xsl:param name="db.host" select="'db'"/>
  <xsl:param name="db.port" select="'5432'"/>
  <xsl:param name="db.name" select="'gis'"/>
  <xsl:param name="db.user" select="'postgres'"/>
  <xsl:param name="db.password" select="''"/>

  <xsl:output method="xml" encoding="utf-8" omit-xml-declaration="no" indent="yes"/>

  <xsl:template match="/Map">
    <xsl:copy>
      <xsl:copy-of select="@*"/>
      <xsl:apply-templates select="./*"/>
    </xsl:copy>
  </xsl:template>

  <xsl:template match="Datasource">
    <xsl:choose>
      <xsl:when test="string(child::Parameter[@name = 'type']) = 'postgis'">
        <Datasource>
          <xsl:for-each select="Parameter | text()">
            <xsl:if test="not(@name = 'host' or @name = 'port' or @name = 'dbname' or @name = 'user' or @name = 'password')">
              <xsl:copy-of select="."/>
            </xsl:if>
          </xsl:for-each>
          <Parameter name="host"><xsl:value-of select="$db.host"/></Parameter>
          <Parameter name="port"><xsl:value-of select="$db.port"/> </Parameter>
          <Parameter name="dbname"><xsl:value-of select="$db.name"/></Parameter>
          <Parameter name="user"><xsl:value-of select="$db.user"/></Parameter>
          <Parameter name="password"><xsl:value-of select="$db.password"/></Parameter>
        </Datasource>
      </xsl:when>
      <xsl:otherwise>
        <xsl:copy-of select="."/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="*[local-name() != 'Datasource']">
    <xsl:choose>
      <xsl:when test="self::node()">
        <xsl:copy>
          <xsl:copy-of select="@*"/>
          <xsl:apply-templates select="child::text() | child::node()"/>
        </xsl:copy>
      </xsl:when>
      <xsl:otherwise>
        <xsl:copy-of select="."/>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>
</xsl:stylesheet>